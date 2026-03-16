/**
 * Unit tests for ratings module.
 * BUG-2: Histogram shape — exactly keys 1–5, no 0/-1; fixture-based with no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as common from '../lib/common.js';
import { HttpError, RatingsEmptyError, ValidationError } from '../lib/errors.js';
import { ratings, parseRatings } from '../lib/ratings.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
  };
});

/** Build HTML with .rating-count and N .vote .total elements (order 5→1). */
function fixtureHtml(totalCount: number, ...voteTotals: number[]): string {
  const ratingCount = `<div class="rating-count">${totalCount}</div>`;
  const votes = voteTotals
    .map((n) => `<span class="vote"><span class="total">${n}</span></span>`)
    .join('');
  return `<div>${ratingCount}${votes}</div>`;
}

describe('parseRatings', () => {
  it('returns histogram with keys 1–5 only when exactly 5 .vote .total elements', () => {
    const html = fixtureHtml(100, 10, 20, 30, 25, 15);
    const result = parseRatings(html);

    expect(result.ratings).toBe(100);
    expect(result.warnings).toBeUndefined();
    expect(Object.keys(result.histogram).sort()).toEqual(['1', '2', '3', '4', '5']);
    // Order in HTML is 5,4,3,2,1 → index 0→5, 1→4, 2→3, 3→2, 4→1
    expect(result.histogram[5]).toBe(10);
    expect(result.histogram[4]).toBe(20);
    expect(result.histogram[3]).toBe(30);
    expect(result.histogram[2]).toBe(25);
    expect(result.histogram[1]).toBe(15);
    expect(Object.keys(result.histogram)).not.toContain('0');
    expect(Object.keys(result.histogram)).not.toContain('-1');
  });

  it('slices to 5 when more than 5 .vote .total elements (no 0/-1 keys)', () => {
    // Total must match sum of first 5 (sanity check); extra elements are ignored.
    const html = fixtureHtml(15, 1, 2, 3, 4, 5, 99, 100);
    const result = parseRatings(html);

    expect(Object.keys(result.histogram).sort()).toEqual(['1', '2', '3', '4', '5']);
    expect(result.histogram[5]).toBe(1);
    expect(result.histogram[4]).toBe(2);
    expect(result.histogram[3]).toBe(3);
    expect(result.histogram[2]).toBe(4);
    expect(result.histogram[1]).toBe(5);
    expect(Object.keys(result.histogram)).not.toContain('0');
    expect(Object.keys(result.histogram)).not.toContain('6');
  });

  it('uses only available elements when fewer than 5 .vote .total (rest stay 0)', () => {
    const html = fixtureHtml(50, 10, 20, 20);
    const result = parseRatings(html);

    expect(Object.keys(result.histogram).sort()).toEqual(['1', '2', '3', '4', '5']);
    expect(result.histogram[5]).toBe(10);
    expect(result.histogram[4]).toBe(20);
    expect(result.histogram[3]).toBe(20);
    expect(result.histogram[2]).toBe(0);
    expect(result.histogram[1]).toBe(0);
  });

  it('does not warn when totalRatings is 0 (even if histogram has values)', () => {
    // totalRatings = 0, bars sum to 5; mismatch check uses totalRatings > 0 so no warning
    const html = fixtureHtml(0, 1, 1, 1, 1, 1);
    const result = parseRatings(html);
    expect(result.ratings).toBe(0);
    expect(result.warnings).toBeUndefined();
  });

  it('parses total from .rating-count and handles missing count', () => {
    const htmlNoCount = '<div><span class="vote"><span class="total">1</span></span></div>';
    const result = parseRatings(htmlNoCount);
    expect(result.ratings).toBe(0);
    expect(result.histogram[5]).toBe(1);
  });

  it('parses totals with thousands separators in .rating-count', () => {
    const html =
      '<div><div class="rating-count">1,234 Ratings</div><span class="vote"><span class="total">1234</span></span></div>';
    const result = parseRatings(html);
    expect(result.ratings).toBe(1234);
  });

  it('parses totals with localized spacing separators in .rating-count', () => {
    const html =
      '<div><div class="rating-count">12\u00A0345 Ratings</div><span class="vote"><span class="total">12345</span></span></div>';
    const result = parseRatings(html);
    expect(result.ratings).toBe(12345);
  });

  it('returns parsed result with warnings when histogram sum does not match total (page structure change)', () => {
    // Total 999 but first 5 bars sum to 10+20+30+25+15 = 100; sanity check detects mismatch.
    const html = fixtureHtml(999, 10, 20, 30, 25, 15);
    const result = parseRatings(html);
    expect(result.ratings).toBe(999);
    expect(result.histogram[5]).toBe(10);
    expect(result.histogram[4]).toBe(20);
    expect(result.histogram[3]).toBe(30);
    expect(result.histogram[2]).toBe(25);
    expect(result.histogram[1]).toBe(15);
    expect(result.warnings).toBeDefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toContain('100');
    expect(result.warnings![0]).toContain('999');
    expect(result.warnings![0]).toContain('does not match');
  });
});

/** Build HTML with aria-label on each .vote row indicating star rating. */
function labeledFixtureHtml(
  totalCount: number,
  entries: Array<{ star: number; count: number }>
): string {
  const ratingCount = `<div class="rating-count">${totalCount}</div>`;
  const votes = entries
    .map(
      (e) =>
        `<span class="vote" aria-label="${e.star} star">` +
        `<span class="total">${e.count}</span></span>`
    )
    .join('');
  return `<div>${ratingCount}${votes}</div>`;
}

describe('parseRatings label-based extraction', () => {
  it('uses aria-label star ratings when all 5 labels are present (descending)', () => {
    const html = labeledFixtureHtml(100, [
      { star: 5, count: 50 },
      { star: 4, count: 20 },
      { star: 3, count: 15 },
      { star: 2, count: 10 },
      { star: 1, count: 5 },
    ]);
    const result = parseRatings(html);
    expect(result.histogram).toEqual({ 1: 5, 2: 10, 3: 15, 4: 20, 5: 50 });
    expect(result.warnings).toBeUndefined();
  });

  it('correctly parses ascending order when labels are present (no inversion)', () => {
    const html = labeledFixtureHtml(100, [
      { star: 1, count: 5 },
      { star: 2, count: 10 },
      { star: 3, count: 15 },
      { star: 4, count: 20 },
      { star: 5, count: 50 },
    ]);
    const result = parseRatings(html);
    // Without labels this would silently invert; with labels, order is correct
    expect(result.histogram).toEqual({ 1: 5, 2: 10, 3: 15, 4: 20, 5: 50 });
    expect(result.warnings).toBeUndefined();
  });

  it('correctly parses arbitrary order when labels are present', () => {
    const html = labeledFixtureHtml(30, [
      { star: 3, count: 10 },
      { star: 5, count: 8 },
      { star: 1, count: 2 },
      { star: 4, count: 6 },
      { star: 2, count: 4 },
    ]);
    const result = parseRatings(html);
    expect(result.histogram).toEqual({ 1: 2, 2: 4, 3: 10, 4: 6, 5: 8 });
  });

  it('parses "N Stars" text in row content (case-insensitive)', () => {
    const html = `<div>
      <div class="rating-count">15</div>
      <span class="vote">5 Stars<span class="total">5</span></span>
      <span class="vote">4 Stars<span class="total">4</span></span>
      <span class="vote">3 Stars<span class="total">3</span></span>
      <span class="vote">2 Stars<span class="total">2</span></span>
      <span class="vote">1 Star<span class="total">1</span></span>
    </div>`;
    const result = parseRatings(html);
    expect(result.histogram).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
  });

  it('falls back to positional when labels are missing', () => {
    // No aria-labels or star text — should use positional (descending) assumption
    const html = fixtureHtml(100, 50, 20, 15, 10, 5);
    const result = parseRatings(html);
    expect(result.histogram).toEqual({ 1: 5, 2: 10, 3: 15, 4: 20, 5: 50 });
  });

  it('falls back to positional when only some labels are present', () => {
    const html = `<div>
      <div class="rating-count">15</div>
      <span class="vote" aria-label="5 star"><span class="total">5</span></span>
      <span class="vote"><span class="total">4</span></span>
      <span class="vote"><span class="total">3</span></span>
      <span class="vote"><span class="total">2</span></span>
      <span class="vote"><span class="total">1</span></span>
    </div>`;
    const result = parseRatings(html);
    // Positional: first element = 5★, last = 1★
    expect(result.histogram).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
  });
});

describe('ratings()', () => {
  beforeEach(() => {
    vi.mocked(common.doRequest).mockReset();
  });

  it('throws ValidationError when id is missing', async () => {
    const err = await ratings({ id: undefined! }).then(
      () => expect.fail('expected rejection'),
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as Error).message).toBe('id is required');
  });

  it('passes X-Apple-Store-Front header with correct storefront', async () => {
    const html = fixtureHtml(10, 2, 2, 2, 2, 2);
    vi.mocked(common.doRequest).mockResolvedValue(html);

    await ratings({ id: 123, country: 'us' });

    expect(common.doRequest).toHaveBeenCalledWith(
      expect.stringContaining('customer-reviews/id123'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Apple-Store-Front': expect.stringContaining('143441'),
        }),
      })
    );
  });

  it('passes custom requestOptions headers merged with store front', async () => {
    const html = fixtureHtml(10, 2, 2, 2, 2, 2);
    vi.mocked(common.doRequest).mockResolvedValue(html);

    await ratings({ id: 123, country: 'us', requestOptions: { headers: { 'X-Custom': 'test' } } });

    expect(common.doRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Apple-Store-Front': expect.stringContaining('143441'),
          'X-Custom': 'test',
        }),
      })
    );
  });

  it('throws RatingsEmptyError (instanceof HttpError) when response body is empty', async () => {
    vi.mocked(common.doRequest).mockResolvedValue('');
    const url = `https://itunes.apple.com/${DEFAULT_COUNTRY}/customer-reviews/id123?displayable-kind=11`;

    const err = await ratings({ id: 123 }).then(
      () => expect.fail('expected rejection'),
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(RatingsEmptyError);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({
      message: 'No ratings data returned',
      status: 200,
      url,
    });
  });
});
