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
 * @throws {HttpError} When the response is 200 OK but the body is empty, throws with {@link RATINGS_EMPTY_MESSAGE} and `status: 200`. Use `err instanceof HttpError && err.status === 200` to treat as "no data".
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

  // Extract per-row vote elements. Each .vote row has a .total with the count.
  // We try to detect the star rating from labels in the row (aria-label, text
  // containing a digit like "5 stars") to avoid relying on positional order.
  const voteRows = $('.vote');
  const warnings: string[] = [];

  // Attempt label-based extraction: look for a star number in each row's
  // aria-label or text content (e.g. "5 stars", "5 Stars", aria-label="5").
  const STAR_LABEL_RE = /\b([1-5])\s*star/i;
  const STAR_ARIA_RE = /\b([1-5])\b/;
  const labeledEntries: Array<{ star: number; count: number }> = [];

  voteRows.each((_, row) => {
    const $row = $(row);
    const countText = $row.find('.total').text();
    const parsed = parseInt(countText, 10);
    const count = Number.isNaN(parsed) ? 0 : parsed;

    // Try aria-label on the row or its children, then fall back to text matching
    const ariaLabel = $row.attr('aria-label') ?? $row.find('[aria-label]').attr('aria-label') ?? '';
    const textMatch = ariaLabel.match(STAR_LABEL_RE) ?? $row.text().match(STAR_LABEL_RE);
    const ariaMatch = !textMatch ? ariaLabel.match(STAR_ARIA_RE) : null;
    const match = textMatch ?? ariaMatch;

    if (match?.[1]) {
      labeledEntries.push({ star: parseInt(match[1], 10), count });
    }
  });

  const histogram: RatingHistogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const validStars = new Set([1, 2, 3, 4, 5]);

  // Check if label-based extraction found all 5 unique star ratings
  const labeledStars = new Set(labeledEntries.map((e) => e.star));
  const hasAllLabels = validStars.size === labeledStars.size && [...validStars].every((s) => labeledStars.has(s));

  if (hasAllLabels) {
    // Use label-based mapping (order-independent)
    for (const entry of labeledEntries) {
      if (entry.star >= 1 && entry.star <= 5) {
        histogram[entry.star as 1 | 2 | 3 | 4 | 5] = entry.count;
      }
    }
  } else {
    // Fall back to positional assumption: descending order (5★, 4★, 3★, 2★, 1★).
    const rawByStar: number[] = $('.vote .total')
      .map((_, el) => {
        const n = parseInt($(el).text(), 10);
        return Number.isNaN(n) ? 0 : n;
      })
      .get();
    const ratingsByStar = rawByStar.slice(0, 5);

    const STAR_KEYS = [1, 2, 3, 4, 5] as const;
    for (let index = 0; index < ratingsByStar.length; index++) {
      const starRating = STAR_KEYS[4 - index];
      if (starRating !== undefined) {
        histogram[starRating] = ratingsByStar[index]!;
      }
    }
  }

  // Sanity check: histogram sum should match total when we have a total.
  const histogramSum = histogram[1] + histogram[2] + histogram[3] + histogram[4] + histogram[5];
  const mismatch = totalRatings > 0 && histogramSum !== totalRatings;
  if (mismatch) {
    warnings.push(
      `Ratings histogram sum (${histogramSum}) does not match total count (${totalRatings}). Data may be inconsistent.`
    );
  }
  return { ratings: totalRatings, histogram, ...(warnings.length > 0 && { warnings }) };
}
