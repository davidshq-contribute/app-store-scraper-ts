import * as cheerio from 'cheerio';
import type { App } from '../types/app.js';
import type { AppOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { doRequest, lookup, validateRequiredField } from './common.js';
import { ratings } from './ratings.js';

/**
 * Extracts a clean screenshot URL from srcset attribute.
 * Picks the highest-resolution variant and normalizes to a stable size and the original format.
 *
 * Normalization uses 392x696 (2x iPhone logical size) for a consistent, predictable URL.
 * The same size is used for all device types (iPhone, iPad, Apple TV); the store page
 * srcset may still reflect device-specific aspect ratios before normalization.
 * Original image format (webp, jpg, png) is preserved.
 */
function extractScreenshotUrl(srcset: string): string | null {
  // srcset format: "url1 300w, url2 600w, ..."
  const entries = srcset.split(',').map(entry => {
    const parts = entry.trim().split(/\s+/);
    const url = parts[0];
    const widthPart = parts[1];
    const widthMatch = widthPart?.match(/(\d+)w/);
    const width = widthMatch?.[1] ? parseInt(widthMatch[1], 10) : 0;
    return { url, width };
  });

  entries.sort((a, b) => b.width - a.width);
  const best = entries[0];

  if (best?.url) {
    // Normalize resolution to 392x696, preserve original extension (webp, jpg, png)
    return best.url.replace(
      /\/\d+x\d+bb(-\d+)?\.(webp|jpg|jpeg|png)$/i,
      (_match: string, _opt: string | undefined, ext: string | undefined) =>
        `/392x696bb.${(ext ?? 'webp').toLowerCase()}`
    );
  }

  return null;
}

/**
 * Scrapes screenshots from the App Store page when the API doesn't return them
 */
async function scrapeScreenshots(
  appId: number,
  country: string,
  requestOptions?: AppOptions['requestOptions']
): Promise<{ screenshots: string[]; ipadScreenshots: string[]; appletvScreenshots: string[] }> {
  const screenshots = new Set<string>();
  const ipadScreenshots = new Set<string>();
  const appletvScreenshots = new Set<string>();

  try {
    const url = `https://apps.apple.com/${country}/app/id${appId}`;
    const body = await doRequest(url, requestOptions);
    const $ = cheerio.load(body);

    // Find screenshot containers by their class patterns
    // iPhone screenshots: shelf-grid__list--grid-type-ScreenshotPhone
    // iPad screenshots: shelf-grid__list--grid-type-ScreenshotPad
    // Apple TV screenshots: shelf-grid__list--grid-type-ScreenshotAppleTv

    // iPhone screenshots
    $('ul.shelf-grid__list--grid-type-ScreenshotPhone source[type="image/webp"]').each((_, el) => {
      const srcset = $(el).attr('srcset');
      if (srcset) {
        const screenshotUrl = extractScreenshotUrl(srcset);
        if (screenshotUrl) screenshots.add(screenshotUrl);
      }
    });

    // iPad screenshots
    $('ul.shelf-grid__list--grid-type-ScreenshotPad source[type="image/webp"]').each((_, el) => {
      const srcset = $(el).attr('srcset');
      if (srcset) {
        const screenshotUrl = extractScreenshotUrl(srcset);
        if (screenshotUrl) ipadScreenshots.add(screenshotUrl);
      }
    });

    // Apple TV screenshots
    $('ul.shelf-grid__list--grid-type-ScreenshotAppleTv source[type="image/webp"]').each((_, el) => {
      const srcset = $(el).attr('srcset');
      if (srcset) {
        const screenshotUrl = extractScreenshotUrl(srcset);
        if (screenshotUrl) appletvScreenshots.add(screenshotUrl);
      }
    });
  } catch (error) {
    // 404 = app page not found; treat as no screenshots. Other errors (timeout, 500, parse) rethrow.
    const isNotFound =
      error instanceof Error &&
      (error.message.includes('status 404') || error.message.includes('App not found'));
    if (!isNotFound) {
      throw error;
    }
  }

  return {
    screenshots: Array.from(screenshots),
    ipadScreenshots: Array.from(ipadScreenshots),
    appletvScreenshots: Array.from(appletvScreenshots),
  };
}

/**
 * Retrieves detailed information about an app from the App Store
 * @param options - Options including either id (trackId) or appId (bundleId)
 * @returns Promise resolving to app details
 * @throws Error if neither id nor appId is provided
 *
 * @example
 * ```typescript
 * // Get app by ID
 * const app = await app({ id: 553834731 });
 *
 * // Get app by bundle ID
 * const app = await app({ appId: 'com.midasplayer.apps.candycrushsaga' });
 *
 * // Get app with rating histogram
 * const app = await app({ id: 553834731, ratings: true });
 * ```
 */
export async function app(options: AppOptions): Promise<App> {
  validateRequiredField(options as Record<string, unknown>, ['id', 'appId'], 'Either id or appId is required');

  const { id, appId, country = DEFAULT_COUNTRY, lang, ratings: includeRatings, requestOptions } = options;
  // lookupId is defined: validateRequiredField ensures at least one of id, appId is present
  const lookupId = (id ?? appId) as string | number;

  const apps = await lookup(
    lookupId,
    id != null ? 'id' : 'bundleId',
    country,
    lang,
    requestOptions
  );

  if (apps.length === 0) {
    throw new Error(`App not found: ${id || appId}`);
  }

  const appData = apps[0]!;

  // If the API didn't return screenshots, try scraping from the App Store page
  const hasNoScreenshots =
    appData.screenshots.length === 0 &&
    appData.ipadScreenshots.length === 0 &&
    appData.appletvScreenshots.length === 0;

  if (hasNoScreenshots) {
    const scrapedScreenshots = await scrapeScreenshots(appData.id, country, requestOptions);
    appData.screenshots = scrapedScreenshots.screenshots;
    appData.ipadScreenshots = scrapedScreenshots.ipadScreenshots;
    appData.appletvScreenshots = scrapedScreenshots.appletvScreenshots;
  }

  // Optionally include rating histogram
  if (includeRatings) {
    try {
      const ratingsData = await ratings({ id: appData.id, country, requestOptions });
      appData.histogram = ratingsData.histogram;
    } catch (error) {
      // 404, empty body, or "no ratings data" = ratings not available for this app; continue without histogram
      const isRatingsUnavailable =
        error instanceof Error &&
        (error.message.includes('status 404') ||
          error.message.includes('No ratings data returned for app'));
      if (!isRatingsUnavailable) {
        throw error;
      }
    }
  }

  return appData;
}
