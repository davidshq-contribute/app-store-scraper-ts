import type { App } from '../types/app.js';
import type { SearchOptions } from '../types/options.js';
import { doRequest, cleanApp } from './common.js';
import { iTunesLookupResponseSchema } from './schemas.js';

/**
 * Searches for apps in the App Store
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
  const { term, num = 50, page = 1, country = 'us', lang, idsOnly, requestOptions } = options;

  if (!term) {
    throw new Error('term is required');
  }

  // Build query parameters
  const params = new URLSearchParams({
    term,
    country,
    media: 'software',
    entity: 'software',
    limit: String(num)
  });

  if (lang) {
    params.set('lang', lang);
  }

  const url = `https://itunes.apple.com/search?${params.toString()}`;
  const body = await doRequest(url, requestOptions);

  // Parse and validate response with Zod
  const parsedData: unknown = JSON.parse(body);
  const validationResult = iTunesLookupResponseSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `Search API response validation failed: ${validationResult.error.message}`
    );
  }

  const response = validationResult.data;

  // iTunes Search API doesn't support pagination directly, so we handle it client-side
  // Note: This means we fetch all results up to the limit and slice them
  const allResults = response.results.filter((app) => app.kind === 'software');

  // Apply pagination
  const start = (page - 1) * num;
  const end = start + num;
  const paginatedResults = allResults.slice(start, end);

  if (idsOnly) {
    return paginatedResults
      .map((result) => result.trackId)
      .filter((id): id is number => id !== undefined);
  }

  // Convert to App objects
  return paginatedResults.map((result) => cleanApp(result));
}
