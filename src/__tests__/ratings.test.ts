/**
 * Unit tests for ratings module.
 * BUG-2: Histogram shape — exactly keys 1–5, no 0/-1; fixture-based with no network.
 */
import { describe, it, expect } from 'vitest';
import { parseRatings } from '../lib/ratings.js';

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
    const html = fixtureHtml(200, 1, 2, 3, 4, 5, 99, 100);
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

  it('parses total from .rating-count and handles missing count', () => {
    const htmlNoCount = '<div><span class="vote"><span class="total">1</span></span></div>';
    const result = parseRatings(htmlNoCount);
    expect(result.ratings).toBe(0);
    expect(result.histogram[5]).toBe(1);
  });
});
