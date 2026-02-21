import type { App } from '../types/app.js';
import type { SearchOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { doRequest, cleanApp, parseJson } from './common.js';
import { iTunesLookupResponseSchema, type ITunesAppResponse } from './schemas.js';

/** iTunes Search API maximum results per request (Apple-enforced). */
const ITUNES_SEARCH_MAX_LIMIT = 200;

/**
 * Searches for apps in the App Store.
 *
 * Pagination is implemented client-side: the API is called with a limit of
 * `min(page * num, 200)` so that the requested page has results, then results
 * are sliced to the current page. The iTunes Search API returns at most 200
 * results per query (no offset), so only the first 200 hits are accessible.
 * Requesting a page beyond that (e.g. `page: 5` with `num: 50`) yields fewer
 * results or an empty page; a warning is emitted in that case.
 *
 * @param options - Search options including term, pagination, etc.
 * @returns Promise resolving to array of apps or app IDs
 *
 * @example
 * ```typescript
 * // Basic search
 * const apps = await search({ term: 'minecraft' });
 *
 * // Search with pagination
 * const apps = await search({
 *   term: 'puzzle game',
 *   num: 25,
 *   page: 2
 * });
 *
 * // Get only IDs
 * const ids = await search({
 *   term: 'social',
 *   idsOnly: true
 * });
 * ```
 */
export async function search(options: SearchOptions): Promise<App[] | number[]> {
  const { term, num = 50, page = 1, country = DEFAULT_COUNTRY, lang, idsOnly, requestOptions } = options;

  if (!term) {
    throw new Error('term is required');
  }

  // Request enough results to cover the requested page. The iTunes Search API
  // has no offset and a hard cap of 200; we request up to that and slice client-side.
  const requestedLimit = page * num;
  if (requestedLimit > ITUNES_SEARCH_MAX_LIMIT) {
    console.warn(
      `search(): page * num (${requestedLimit}) exceeds iTunes Search API limit (${ITUNES_SEARCH_MAX_LIMIT}). ` +
        `You may get fewer than ${num} results or an empty page.`
    );
  }
  const limit = Math.min(requestedLimit, ITUNES_SEARCH_MAX_LIMIT);

  const params = new URLSearchParams({
    term,
    country,
    media: 'software',
    entity: 'software',
    limit: String(limit)
  });

  if (lang) {
    params.set('lang', lang);
  }

  const url = `https://itunes.apple.com/search?${params.toString()}`;
  const body = await doRequest(url, requestOptions);

  // Parse and validate response with Zod
  const parsedData = parseJson(body);
  const validationResult = iTunesLookupResponseSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `Search API response validation failed: ${validationResult.error.message}`
    );
  }

  const response = validationResult.data;

  // iTunes Search API has no offset; we requested limit (capped at 200) and slice here.
  const allResults = response.results.filter((app: ITunesAppResponse) => app.kind === 'software');

  // Apply pagination
  const start = (page - 1) * num;
  const end = start + num;
  const paginatedResults = allResults.slice(start, end);

  if (idsOnly) {
    return paginatedResults
      .map((result: ITunesAppResponse) => result.trackId)
      .filter((id: number | undefined): id is number => id !== undefined);
  }

  // Convert to App objects
  return paginatedResults.map((result: ITunesAppResponse) => cleanApp(result));
}
