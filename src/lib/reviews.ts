import type { Review } from '../types/review.js';
import type { ReviewsOptions } from '../types/options.js';
import { DEFAULT_COUNTRY, sort as sortConstants } from '../types/constants.js';
import {
  doRequest,
  validateRequiredField,
  ensureArray,
  parseJson,
  resolveAppId,
} from './common.js';
import { ValidationError } from './errors.js';
import { validateCountry, validateSort, validateReviewsPage } from './validate.js';
import { reviewsFeedSchema } from './schemas.js';

/**
 * Retrieves user reviews for an app.
 * @param options - Options including app id, pagination, and sorting
 * @returns Promise resolving to array of reviews
 * @throws {ValidationError} if neither `id` nor `appId` is provided, `country`/`sort`/`page` are invalid, or API response validation fails (field: `'response'`)
 * @throws {HttpError} on non-OK HTTP response from the reviews RSS feed
 * @throws {Error} if `appId` cannot be resolved to a numeric ID (wraps original error as `cause`)
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
    appId,
    page = 1,
    sort = sortConstants.RECENT,
    country = DEFAULT_COUNTRY,
    requestOptions,
  } = options;
  let { id } = options;

  validateCountry(country);
  validateSort(sort);
  validateReviewsPage(page);

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

  const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${id}/sortby=${sort}/json`;

  const body = await doRequest(url, requestOptions);

  // Parse and validate response with Zod
  const parsedData = parseJson(body);
  const validationResult = reviewsFeedSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new ValidationError(
      `Reviews API response validation failed: ${validationResult.error.message}`,
      'response'
    );
  }

  const data = validationResult.data;

  // Extract entries (can be single object or array)
  const entries = ensureArray(data.feed?.entry);

  // Skip the first entry as it's typically app metadata
  const reviewEntries = entries.slice(1);

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
