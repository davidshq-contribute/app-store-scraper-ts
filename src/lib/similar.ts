import * as cheerio from 'cheerio';
import type { App } from '../types/app.js';
import type { SimilarApp } from '../types/app.js';
import type { SimilarOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { appPageUrl, doRequest, validateRequiredField, lookup, resolveAppId } from './common.js';
import { validateCountry } from './validate.js';
import { HttpError, ValidationError } from './errors.js';
import { parseSimilarIdsFromHtml, getLinkTypeFromHeadingText } from './parsers.js';

export { getLinkTypeFromHeadingText };

/**
 * Retrieves similar/related apps from the app page. Optionally labels each by
 * section (e.g. "Customers Also Bought", "More by developer") via `includeLinkType: true`.
 *
 * @param options - Options including app id or appId, and optional `includeLinkType`
 * @returns Promise resolving to `App[]` (default) or `SimilarApp[]` when `includeLinkType: true`
 * @throws {ValidationError} if neither `id` nor `appId` is provided, or if `country` is invalid
 * @throws {HttpError} on non-404 HTTP errors from the App Store page
 * @throws {Error} if `appId` cannot be resolved to a numeric ID (wraps original error as `cause`)
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
  validateRequiredField(options, ['id', 'appId'], 'Either id or appId is required');

  const {
    appId,
    country = DEFAULT_COUNTRY,
    lang,
    requestOptions,
    includeLinkType = false,
  } = options;
  validateCountry(country);
  let { id } = options;

  // If appId is provided, resolve to id first (lightweight lookup only)
  if (appId != null && id == null) {
    try {
      id = await resolveAppId({ appId, country, requestOptions });
    } catch (err) {
      throw new Error(
        `Could not resolve app id "${appId}": ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
  }

  // Defensive: unreachable if validateRequiredField + resolveAppId work correctly,
  // but guards against future control-flow changes.
  if (id == null) {
    throw new ValidationError('Either id or appId is required', 'id/appId');
  }

  // Build URL for main app page (contains similar apps embedded in HTML)
  const url = appPageUrl(country, id);

  let body: string;
  try {
    body = await doRequest(url, requestOptions);
  } catch (error) {
    // 404 means the app page does not exist; treat as "no similar apps"
    if (error instanceof HttpError && error.status === 404) {
      return [];
    }
    throw error;
  }

  const $ = cheerio.load(body);
  const entries = parseSimilarIdsFromHtml($, id);

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
