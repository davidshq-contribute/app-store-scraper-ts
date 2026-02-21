import * as cheerio from 'cheerio';
import type { Ratings, RatingHistogram } from '../types/app.js';
import type { RatingsOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { doRequest, storeId } from './common.js';

/**
 * Retrieves the rating histogram for an app (1-5 star breakdown)
 * @param options - Options including app id
 * @returns Promise resolving to ratings with total count and histogram
 *
 * @example
 * ```typescript
 * const result = await ratings({ id: 553834731 });
 * // Returns: { ratings: 4800, histogram: { 1: 100, 2: 200, 3: 500, 4: 1000, 5: 3000 } }
 * ```
 */
export async function ratings(options: RatingsOptions): Promise<Ratings> {
  const { id, country = DEFAULT_COUNTRY, requestOptions } = options;

  if (!id) {
    throw new Error('id is required');
  }

  const storeFront = storeId(country);
  const url = `https://itunes.apple.com/${country}/customer-reviews/id${id}?displayable-kind=11`;

  const html = await doRequest(url, {
    ...(requestOptions || {}),
    headers: {
      'X-Apple-Store-Front': `${storeFront},12`,
      ...(requestOptions?.headers || {}),
    },
  });

  if (html.length === 0) {
    throw new Error(`No ratings data returned for app ${id}`);
  }

  return parseRatings(html);
}

/**
 * Parses ratings from iTunes customer-reviews HTML.
 * Exported for unit testing (histogram shape / BUG-2).
 * @param html - Raw HTML from the customer-reviews page
 * @returns Ratings with total count and histogram (keys 1–5 only)
 */
export function parseRatings(html: string): Ratings {
  const $ = cheerio.load(html);

  // Extract total rating count
  const ratingsMatch = $('.rating-count').text().match(/\d+/);
  const totalRatings = Array.isArray(ratingsMatch) && ratingsMatch[0]
    ? parseInt(ratingsMatch[0], 10)
    : 0;

  // Extract ratings by star (displayed from 5 to 1). Slice to exactly 5 so
  // starRating = 5 - index is always 1–5 (avoids 0/-1 with wrong element count).
  const rawByStar: number[] = $('.vote .total')
    .map((_, el) => {
      const n = parseInt($(el).text(), 10);
      return Number.isNaN(n) ? 0 : n;
    })
    .get();
  const ratingsByStar = rawByStar.slice(0, 5);

  // Build histogram (convert array index to star rating 5,4,3,2,1)
  const histogram: RatingHistogram = ratingsByStar.reduce<RatingHistogram>(
    (acc, ratingsForStar, index) => {
      const starRating = (5 - index) as 1 | 2 | 3 | 4 | 5;
      acc[starRating] = ratingsForStar;
      return acc;
    },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  );

  return { ratings: totalRatings, histogram };
}
