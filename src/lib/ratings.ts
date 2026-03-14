import * as cheerio from 'cheerio';
import type { Ratings, RatingHistogram } from '../types/app.js';
import type { RatingsOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { doRequest, storeId } from './common.js';
import { validateCountry } from './validate.js';
import { HttpError, ValidationError } from './errors.js';

/** Message used when the ratings endpoint returns 200 OK but an empty body (no parseable data). */
export const RATINGS_EMPTY_MESSAGE = 'No ratings data returned';

/**
 * Retrieves the rating histogram for an app (1-5 star breakdown).
 *
 * @param options - Options including app id
 * @returns Promise resolving to ratings with total count and histogram
 * @throws {HttpError} When the response is 200 OK but the body is empty, throws with {@link RATINGS_EMPTY_MESSAGE} and `status: 200`. Use `err instanceof HttpError && err.status === 200 && err.message === RATINGS_EMPTY_MESSAGE` to treat as "no data" without conflating with HTTP 204.
 *
 * `requestOptions.headers` can override the default `X-Apple-Store-Front` header; this is intentional for advanced use cases (e.g. store-specific or regional testing).
 *
 * @example
 * ```typescript
 * const result = await ratings({ id: 553834731 });
 * // Returns: { ratings: 4800, histogram: { 1: 100, 2: 200, 3: 500, 4: 1000, 5: 3000 } }
 * // May include optional warnings when histogram sum does not match total.
 * ```
 */
export async function ratings(options: RatingsOptions): Promise<Ratings> {
  const { id, country = DEFAULT_COUNTRY, requestOptions } = options;

  validateCountry(country);
  if (id == null) {
    throw new ValidationError('id is required', 'id');
  }

  const storeFront = storeId(country);
  const url = `https://itunes.apple.com/${country}/customer-reviews/id${id}?displayable-kind=11`;

  const html = await doRequest(url, {
    ...(requestOptions ?? {}),
    headers: {
      'X-Apple-Store-Front': `${storeFront},12`,
      ...(requestOptions?.headers ?? {}),
    },
  });

  if (html.length === 0) {
    throw new HttpError(RATINGS_EMPTY_MESSAGE, 200, url);
  }

  return parseRatings(html);
}

/**
 * Parses ratings from iTunes customer-reviews HTML.
 * Exported for unit testing (histogram shape / BUG-2).
 * When the histogram bar sum does not match the total count (e.g. page structure change),
 * returns the parsed result with a `warnings` array; consumers control logging.
 * @param html - Raw HTML from the customer-reviews page
 * @returns Ratings with total count and histogram (keys 1–5 only). May include `warnings` when histogram sum ≠ total.
 */
export function parseRatings(html: string): Ratings {
  const $ = cheerio.load(html);

  // Extract total rating count
  const ratingsMatch = $('.rating-count').text().match(/\d+/);
  const totalRatings =
    Array.isArray(ratingsMatch) && ratingsMatch[0] ? parseInt(ratingsMatch[0], 10) : 0;

  // Extract ratings by star. Assumes the page renders bars in descending order
  // (5★, 4★, 3★, 2★, 1★). We do not verify per-row labels; if Apple changes
  // to ascending order, the histogram would be silently inverted. Slice to
  // exactly 5 so starRating = 5 - index is always 1–5 (avoids 0/-1 with wrong
  // element count).
  const rawByStar: number[] = $('.vote .total')
    .map((_, el) => {
      const n = parseInt($(el).text(), 10);
      return Number.isNaN(n) ? 0 : n;
    })
    .get();
  const ratingsByStar = rawByStar.slice(0, 5);

  // Build histogram. Bars are in descending order (5★…1★); index 0 → 5, index 4 → 1.
  // Derive key from index via tuple so type is 1|2|3|4|5 without assertion.
  const STAR_KEYS = [1, 2, 3, 4, 5] as const;
  const histogram: RatingHistogram = ratingsByStar.reduce<RatingHistogram>(
    (acc, ratingsForStar, index) => {
      const starRating = STAR_KEYS[4 - index];
      if (starRating === undefined) {
        throw new Error(`Unexpected rating index: ${index}`);
      }
      acc[starRating] = ratingsForStar;
      return acc;
    },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  );

  // Sanity check: histogram sum should match total when we have a total.
  // Catches structural changes (e.g. wrong number of .vote .total elements).
  // Does not detect order flip (5↔1); that would require per-row labels in HTML.
  // On mismatch, return parsed result with a warning; consumers control logging.
  const histogramSum = histogram[1] + histogram[2] + histogram[3] + histogram[4] + histogram[5];
  const mismatch = totalRatings > 0 && histogramSum !== totalRatings;
  const warnings = mismatch
    ? [
        `Ratings histogram sum (${histogramSum}) does not match total count (${totalRatings}). Data may be inconsistent.`,
      ]
    : undefined;
  return { ratings: totalRatings, histogram, ...(warnings && { warnings }) };
}
