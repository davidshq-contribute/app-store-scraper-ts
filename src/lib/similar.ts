import * as cheerio from 'cheerio';
import type { App } from '../types/app.js';
import type { SimilarApp, SimilarLinkType } from '../types/app.js';
import type { SimilarOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { doRequest, validateRequiredField, lookup } from './common.js';
import { app as getApp } from './app.js';

/** Section heading text patterns (case-insensitive) mapped to linkType. */
const SECTION_PATTERNS: Array<{ pattern: RegExp; linkType: SimilarLinkType }> = [
  { pattern: /customers\s+also\s+bought/i, linkType: 'customers-also-bought' },
  { pattern: /more\s+from\s+(this\s+)?developer|more\s+by\s+developer/i, linkType: 'more-by-developer' },
  { pattern: /you\s+might\s+also\s+like/i, linkType: 'you-might-also-like' },
  { pattern: /similar\s+apps|related\s+apps/i, linkType: 'similar-apps' },
];

function getLinkTypeFromHeadingText(text: string): SimilarLinkType {
  const trimmed = text.trim();
  for (const { pattern, linkType } of SECTION_PATTERNS) {
    if (pattern.test(trimmed)) return linkType;
  }
  return 'other';
}

/**
 * Retrieves similar/related apps from the app page. Optionally labels each by
 * section (e.g. "Customers Also Bought", "More by developer") via `includeLinkType: true`.
 *
 * @param options - Options including app id or appId, and optional `includeLinkType`
 * @returns Promise resolving to `App[]` (default) or `SimilarApp[]` when `includeLinkType: true`
 *
 * @example
 * ```typescript
 * // Backward compatible: plain App[]
 * const apps = await similar({ id: 553834731 });
 *
 * // With section labels
 * const results = await similar({ id: 553834731, includeLinkType: true });
 * results.forEach(({ app, linkType }) => {
 *   console.log(`${app.title} (${linkType})`);
 * });
 * ```
 */
export async function similar(
  options: SimilarOptions & { includeLinkType: true }
): Promise<SimilarApp[]>;
export async function similar(
  options: SimilarOptions & { includeLinkType?: false }
): Promise<App[]>;
export async function similar(options: SimilarOptions): Promise<SimilarApp[] | App[]> {
  validateRequiredField(options as Record<string, unknown>, ['id', 'appId'], 'Either id or appId is required');

  const { appId, country = DEFAULT_COUNTRY, lang, requestOptions, includeLinkType = false } = options;
  let { id } = options;

  // If appId is provided, resolve to id first
  if (appId && !id) {
    const appData = await getApp({ appId, country, requestOptions });
    id = appData.id;
  }

  if (!id) {
    throw new Error('Could not resolve app id');
  }

  // Build URL for main app page (contains similar apps embedded in HTML)
  const url = `https://apps.apple.com/${country}/app/id${id}`;

  let body: string;
  try {
    body = await doRequest(url, requestOptions);
  } catch (error) {
    // 404 means the app page does not exist; treat as "no similar apps"
    if (error instanceof Error && error.message.includes('status 404')) {
      return [];
    }
    throw error;
  }

  // Parse HTML with cheerio
  const $ = cheerio.load(body);

  // Collect (id, linkType) in document order by walking headings and app links together
  const entries: Array<{ id: number; linkType: SimilarLinkType }> = [];
  let currentLinkType: SimilarLinkType = 'other';

  $('body')
    .find('h2, h3, h4, a[href*="/app/"]')
    .each((_, element) => {
      const $el = $(element);
      const tagName = element.tagName?.toLowerCase();

      if (tagName === 'a') {
        const href = $el.attr('href');
        if (href) {
          const match = href.match(/\/id(\d+)/);
          if (match && match[1]) {
            const appIdNum = parseInt(match[1], 10);
            if (appIdNum !== id) {
              entries.push({ id: appIdNum, linkType: currentLinkType });
            }
          }
        }
        return;
      }

      if (tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
        currentLinkType = getLinkTypeFromHeadingText($el.text());
      }
    });

  if (entries.length === 0) {
    return [];
  }

  // Unique IDs for lookup (preserve order)
  const uniqueIds = [...new Set(entries.map((e) => e.id))];
  const apps = await lookup(uniqueIds, 'id', country, lang, requestOptions);
  const appById = new Map<number, App>(apps.map((a) => [a.id, a]));

  if (includeLinkType) {
    // Build result in original order, one row per unique (app, linkType); dedupe same app in same section
    const results: SimilarApp[] = [];
    const seen = new Set<string>();
    for (const { id: entryId, linkType } of entries) {
      const key = `${entryId}:${linkType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const app = appById.get(entryId);
      if (app) results.push({ app, linkType });
    }
    return results;
  }

  // Backward compatible: return App[] (deduplicated, same order as uniqueIds)
  return uniqueIds.map((uid) => appById.get(uid)).filter((a): a is App => a !== undefined);
}
