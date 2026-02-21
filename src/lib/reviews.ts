import type { Review } from '../types/review.js';
import type { ReviewsOptions } from '../types/options.js';
import { DEFAULT_COUNTRY, sort as sortConstants } from '../types/constants.js';
import { doRequest, validateRequiredField, ensureArray, parseJson, resolveAppId } from './common.js';
import { validateCountry, validateSort, validateReviewsPage } from './validate.js';
import { reviewsFeedSchema } from './schemas.js';

/**
 * Retrieves user reviews for an app
 * @param options - Options including app id, pagination, and sorting
 * @returns Promise resolving to array of reviews
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
  validateRequiredField(options as Record<string, unknown>, ['id', 'appId'], 'Either id or appId is required');

  const { appId, page = 1, sort = sortConstants.RECENT, country = DEFAULT_COUNTRY, requestOptions } = options;
  let { id } = options;

  validateCountry(country);
  validateSort(sort);
  validateReviewsPage(page);

  // If appId is provided, resolve to id first (lightweight lookup only)
  if (appId != null && id == null) {
    id = await resolveAppId({ appId, country, requestOptions });
  }

  if (id == null) {
    throw new Error('Could not resolve app id');
  }

  const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${id}/sortby=${sort}/json`;

  const body = await doRequest(url, requestOptions);

  // Parse and validate response with Zod
  const parsedData = parseJson(body);
  const validationResult = reviewsFeedSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `Reviews API response validation failed: ${validationResult.error.message}`
    );
  }

  const data = validationResult.data;

  // Extract entries (can be single object or array)
  const entries = ensureArray(data.feed?.entry);

  // Skip the first entry as it's typically app metadata
  const reviewEntries = entries.slice(1);

  return reviewEntries.map((entry) => {
    const label = entry['im:rating']?.label;
    const rawScore =
      label === undefined || label === '' ? NaN : parseInt(label, 10);
    // 0 = missing/invalid (see Review.score JSDoc); valid ratings 1–5, clamped to 0–5
    const score =
      Number.isNaN(rawScore) ? 0 : Math.max(0, Math.min(5, rawScore));
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
