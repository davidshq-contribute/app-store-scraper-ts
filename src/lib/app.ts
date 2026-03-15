import * as cheerio from 'cheerio';
import type { App } from '../types/app.js';
import type { AppOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { appPageUrl, doRequest, lookup, validateRequiredField } from './common.js';
import { validateCountry } from './validate.js';
import { HttpError } from './errors.js';
import { ratings, RATINGS_EMPTY_MESSAGE } from './ratings.js';

/**
 * Extracts a clean screenshot URL from srcset attribute.
 * Picks the highest-resolution variant and normalizes to a stable size and the original format.
 *
 * Normalization uses 392x696 (2x iPhone logical size) for a consistent, predictable URL.
 * The same size is used for all device types (iPhone, iPad, Apple TV); the store page
 * srcset may still reflect device-specific aspect ratios before normalization.
 * Original image format (webp, jpg, png) is preserved.
 *
 * @internal Exported for fixture-based unit tests (screenshots.test.ts).
 */
export function extractScreenshotUrl(srcset: string): string | null {
  // srcset format: "url1 300w, url2 600w, ..."
  const entries = srcset.split(',').map((entry) => {
    const parts = entry.trim().split(/\s+/);
    const url = parts[0];
    const widthPart = parts[1];
    const widthMatch = widthPart?.match(/(\d+)w/);
    const raw = widthMatch?.[1] ? parseInt(widthMatch[1], 10) : NaN;
    const width = Number.isNaN(raw) ? 0 : raw;
    return { url, width };
  });

  entries.sort((a, b) => b.width - a.width);
  const best = entries[0];

  if (best?.url) {
    // Normalize resolution to 392x696, preserve original extension (webp, jpg, png, avif).
    // Optional (\\?.*)? allows Apple CDN query params (e.g. ?q=80) so normalization still matches.
    return best.url.replace(
      /\/\d+x\d+bb(-\d+)?\.(webp|jpg|jpeg|png|avif)(\?.*)?$/i,
      (
        _match: string,
        _opt: string | undefined,
        ext: string | undefined,
        query: string | undefined
      ) => `/392x696bb.${(ext ?? 'webp').toLowerCase()}${query ?? ''}`
    );
  }

  return null;
}

/**
 * Parses screenshot URLs from App Store page HTML using the same selectors as live scraping.
 * Used by {@link scrapeScreenshots} and by fixture-based unit tests.
 *
 * @param html - Full or partial App Store app page HTML
 * @returns Object with screenshots, ipadScreenshots, and appletvScreenshots arrays
 * @internal Exported for fixture-based unit tests (screenshots.test.ts).
 */
export function parseScreenshotsFromHtml(html: string): {
  screenshots: string[];
  ipadScreenshots: string[];
  appletvScreenshots: string[];
} {
  const screenshots = new Set<string>();
  const ipadScreenshots = new Set<string>();
  const appletvScreenshots = new Set<string>();

  const $ = cheerio.load(html);

  // Find screenshot containers by their class patterns
  // iPhone screenshots: shelf-grid__list--grid-type-ScreenshotPhone
  // iPad screenshots: shelf-grid__list--grid-type-ScreenshotPad
  // Apple TV screenshots: shelf-grid__list--grid-type-ScreenshotAppleTv

  // Extract one screenshot URL per <picture>, preferring webp but falling
  // back to any <source> or <img> when the webp variant is absent.
  function collectFromContainer(selector: string, target: Set<string>): void {
    $(`${selector} picture`).each((_, pictureEl) => {
      const $pic = $(pictureEl);
      const srcset =
        $pic.find('source[type="image/webp"]').attr('srcset') ??
        $pic.find('source[srcset]').attr('srcset') ??
        $pic.find('img').attr('srcset') ??
        $pic.find('img').attr('src');
      if (srcset) {
        const screenshotUrl = extractScreenshotUrl(srcset);
        if (screenshotUrl) target.add(screenshotUrl);
      }
    });
  }

  collectFromContainer('ul.shelf-grid__list--grid-type-ScreenshotPhone', screenshots);
  collectFromContainer('ul.shelf-grid__list--grid-type-ScreenshotPad', ipadScreenshots);
  collectFromContainer('ul.shelf-grid__list--grid-type-ScreenshotAppleTv', appletvScreenshots);

  return {
    screenshots: Array.from(screenshots),
    ipadScreenshots: Array.from(ipadScreenshots),
    appletvScreenshots: Array.from(appletvScreenshots),
  };
}

/**
 * Scrapes screenshots from the App Store page when the API doesn't return them
 */
async function scrapeScreenshots(
  appId: number,
  country: string,
  requestOptions?: AppOptions['requestOptions']
): Promise<{ screenshots: string[]; ipadScreenshots: string[]; appletvScreenshots: string[] }> {
  try {
    const url = appPageUrl(country, appId);
    const body = await doRequest(url, requestOptions);
    return parseScreenshotsFromHtml(body);
  } catch (error) {
    // 404 = app page not found; treat as no screenshots. Other errors (timeout, 500, parse) rethrow.
    if (!(error instanceof HttpError && error.status === 404)) {
      throw error;
    }
    return {
      screenshots: [],
      ipadScreenshots: [],
      appletvScreenshots: [],
    };
  }
}

/**
 * Retrieves detailed information about an app from the App Store.
 * @param options - Options including either id (trackId) or appId (bundleId)
 * @returns Promise resolving to app details
 * @throws {ValidationError} if neither `id` nor `appId` is provided, or if `country` is invalid
 * @throws {HttpError} on non-OK HTTP response from the iTunes API
 * @throws {Error} if the app is not found in the iTunes lookup
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
  validateRequiredField(options, ['id', 'appId'], 'Either id or appId is required');

  const {
    id,
    appId,
    country = DEFAULT_COUNTRY,
    lang,
    ratings: includeRatings,
    requestOptions,
  } = options;
  validateCountry(country);
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
    throw new HttpError(`App not found: ${id || appId}`, 404);
  }

  const appData = apps[0]!;

  // If the API didn't return screenshots, try scraping from the App Store page
  const hasNoScreenshots =
    appData.screenshots.length === 0 &&
    appData.ipadScreenshots.length === 0 &&
    appData.appletvScreenshots.length === 0;

  let result: App = appData;

  if (hasNoScreenshots) {
    const scrapedScreenshots = await scrapeScreenshots(appData.id, country, requestOptions);
    result = {
      ...result,
      screenshots: scrapedScreenshots.screenshots,
      ipadScreenshots: scrapedScreenshots.ipadScreenshots,
      appletvScreenshots: scrapedScreenshots.appletvScreenshots,
    };
  }

  // Optionally include rating histogram
  if (includeRatings) {
    try {
      const ratingsData = await ratings({ id: appData.id, country, requestOptions });
      result = { ...result, histogram: ratingsData.histogram };
    } catch (error) {
      // 404 = ratings endpoint not found; 200 + RATINGS_EMPTY_MESSAGE = empty body.
      // Only these cases are swallowed; other errors (500, network, etc.) propagate.
      if (
        !(
          error instanceof HttpError &&
          (error.status === 404 ||
            (error.status === 200 && error.message === RATINGS_EMPTY_MESSAGE))
        )
      ) {
        throw error;
      }
    }
  }

  return result;
}
