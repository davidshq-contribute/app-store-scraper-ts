import type { App } from '../types/app.js';
import type { SearchOptions } from '../types/options.js';
import { DEFAULT_COUNTRY, device as deviceConstants, ITUNES_API_MAX_LIMIT } from '../types/constants.js';
import { doRequest, cleanApp, parseJson, isAppRecord } from './common.js';
import { ValidationError } from './errors.js';
import { validateCountry, validateSearchPagination, validateDevice } from './validate.js';
import { iTunesLookupResponseSchema, type ITunesAppResponse } from './schemas.js';

/**
 * Searches for apps in the App Store.
 *
 * Pagination is implemented client-side: the API is called with a limit of
 * `min(page * num, ITUNES_API_MAX_LIMIT)` so that the requested page has results, then results
 * are sliced to the current page. The iTunes Search API returns at most ITUNES_API_MAX_LIMIT
 * results per query (no offset), so only that many hits are accessible per search.
 * Requesting a page beyond that (e.g. `page: 5` with `num: 50`) yields fewer
 * results or an empty page.
 *
 * @param options - Search options including term, pagination, etc.
 * @returns When `idsOnly: true`, `Promise<number[]>`; otherwise `Promise<App[]>`.
 * @throws {ValidationError} if `term` is missing, `country`/`num`/`page`/`device` are invalid, or API response validation fails (field: `'response'`)
 * @throws {HttpError} on non-OK HTTP response from the iTunes Search API
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
export async function search(options: SearchOptions & { idsOnly: true }): Promise<number[]>;
export async function search(options: SearchOptions & { idsOnly?: false }): Promise<App[]>;
export async function search(options: SearchOptions): Promise<App[] | number[]>;
export async function search(options: SearchOptions): Promise<App[] | number[]> {
  const {
    term,
    num = 50,
    page = 1,
    country = DEFAULT_COUNTRY,
    lang,
    device: deviceOption,
    idsOnly,
    requestOptions,
  } = options;

  validateCountry(country);
  validateSearchPagination(num, page);
  if (deviceOption != null) validateDevice(deviceOption);
  if (term == null || term === '') {
    throw new ValidationError('term is required', 'term');
  }

  // Request enough results to cover the requested page. The iTunes Search API
  // has no offset and a hard cap of 200; we request up to that and slice client-side.
  const requestedLimit = page * num;
  const limit = Math.min(requestedLimit, ITUNES_API_MAX_LIMIT);

  const entity = deviceOption ?? deviceConstants.ALL;
  const params = new URLSearchParams({
    term,
    country,
    media: 'software',
    entity,
    limit: String(limit),
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
    throw new ValidationError(
      `Search API response validation failed: ${validationResult.error.message}`,
      'response'
    );
  }

  const response = validationResult.data;

  // iTunes Search API has no offset; we requested limit (capped at 200) and slice here.
  // Filter to app records only (excludes artist entries, audiobooks, etc.)
  const allResults = response.results.filter((app) => isAppRecord(app));

  // Apply pagination
  const start = (page - 1) * num;
  const end = start + num;
  const paginatedResults = allResults.slice(start, end);

  if (idsOnly) {
    return paginatedResults
      .map((result: ITunesAppResponse) => result.trackId)
      .filter((id): id is number => id !== undefined);
  }

  // Convert to App objects
  return paginatedResults.map((result: ITunesAppResponse) => cleanApp(result));
}
