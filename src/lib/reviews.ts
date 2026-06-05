import type { Review } from '../types/review.js';
import type { ReviewsOptions } from '../types/options.js';
import { DEFAULT_COUNTRY, sort as sortConstants } from '../types/constants.js';
import {
  doRequest,
  ensureNumericAppId,
  validateRequiredField,
  ensureArray,
  parseAndValidate,
} from './common.js';
import { validateCountry, validateSort, validateReviewsPage } from './validate.js';
import { reviewsFeedSchema } from './schemas.js';

/**
 * Retrieves user reviews for an app.
 * @param options - Options including app id, pagination, and sorting
 * @returns Promise resolving to array of reviews
 * @throws {ValidationError} if neither `id` nor `appId` is provided, `country`/`sort`/`page` are invalid, or API response validation fails (field: `'response'`)
 * @throws {HttpError} on non-OK HTTP response from the reviews RSS feed, or if `appId` cannot be resolved (preserves original status/url)
 *
 * @example
 * ```typescript
 * // Get recent reviews
 * const reviews = await reviews({ id: 553834731 });
 *
 * // Get helpful reviews, page 2
 * const reviews = await reviews({
 *   id: 553834731,
 *   sort: sort.HELPFUL,
 *   page: 2
 * });
 *
 * // Get reviews by bundle ID
 * const reviews = await reviews({
 *   appId: 'com.midasplayer.apps.candycrushsaga',
 *   page: 1
 * });
 * ```
 */
export async function reviews(options: ReviewsOptions): Promise<Review[]> {
  validateRequiredField(options, ['id', 'appId'], 'Either id or appId is required');

  const {
    page = 1,
    sort = sortConstants.RECENT,
    country = DEFAULT_COUNTRY,
    requestOptions,
  } = options;

  validateCountry(country);
  validateSort(sort);
  validateReviewsPage(page);
  const id = await ensureNumericAppId(options);

  const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${id}/sortby=${sort}/json`;

  const body = await doRequest(url, requestOptions);

  const data = parseAndValidate(body, reviewsFeedSchema, 'Reviews API response');

  // Extract entries (can be single object or array)
  const entries = ensureArray(data.feed?.entry);

  // Filter out the app metadata entry. The feed typically includes one metadata
  // entry (app info) that lacks 'author'; real reviews always have an author.
  // Previous code used slice(1) which silently dropped the only review for
  // single-review apps.
  const reviewEntries = entries.filter((entry) => entry.author != null);

  return reviewEntries.map((entry) => {
    const label = entry['im:rating']?.label;
    const rawScore = label === undefined || label === '' ? NaN : parseInt(label, 10);
    // 0 = missing/invalid (see Review.score JSDoc); valid ratings 1–5, clamped to 0–5
    const score = Number.isNaN(rawScore) ? 0 : Math.max(0, Math.min(5, rawScore));
    return {
      id: entry.id?.label ?? '',
      userName: entry.author?.name?.label ?? '',
      userUrl: entry.author?.uri?.label ?? '',
      version: entry['im:version']?.label ?? '',
      score,
      title: entry.title?.label ?? '',
      text: entry.content?.label ?? '',
      updated: entry.updated?.label ?? '',
    };
  });
}
