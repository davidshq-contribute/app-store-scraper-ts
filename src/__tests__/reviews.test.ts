/**
 * Unit tests for reviews module.
 * BUG-1: Guards score parsing when im:rating is missing or unparseable (0 vs 1–5 contract).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reviews } from '../lib/reviews.js';
import * as common from '../lib/common.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
  };
});

describe('reviews', () => {
  beforeEach(() => {
    vi.mocked(common.doRequest).mockReset();
  });

  it('should throw error when neither id nor appId is provided', async () => {
    await expect(reviews({} as Parameters<typeof reviews>[0])).rejects.toThrow(
      'Either id or appId is required'
    );
  });

  it('throws when page is out of range', async () => {
    await expect(
      reviews({ id: 123, page: 0 })
    ).rejects.toThrow('Page must be between 1 and 10');
    await expect(
      reviews({ id: 123, page: 11 })
    ).rejects.toThrow('Page must be between 1 and 10');
  });

  describe('score parsing (BUG-1)', () => {
    /** Minimal feed valid for reviewsFeedSchema: first entry is app metadata (skipped), rest are reviews. */
    const mockFeedWithScores = (
      ...entries: Array<{ 'im:rating'?: { label?: string }; id?: { label?: string }; author?: { name?: { label?: string } }; title?: { label?: string }; content?: { label?: string }; updated?: { label?: string }; 'im:version'?: { label?: string } }>
    ) => ({
      feed: {
        entry: [
          { id: { label: 'app-meta' }, title: { label: 'App' } },
          ...entries.map((e) => ({
            id: e.id ?? { label: 'r1' },
            author: e.author ?? { name: { label: 'User' } },
            'im:version': e['im:version'] ?? { label: '1.0' },
            'im:rating': e['im:rating'],
            title: e.title ?? { label: '' },
            content: e.content ?? { label: '' },
            updated: e.updated ?? { label: '' },
          })),
        ],
      },
    });

    it('uses score 0 when im:rating is missing (documented sentinel)', async () => {
      const feed = mockFeedWithScores({ 'im:rating': undefined });
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(feed));

      const result = await reviews({ id: 553834731, page: 1 });

      expect(result).toHaveLength(1);
      expect(result[0]?.score).toBe(0);
    });

    it('uses score 0 when im:rating.label is unparseable (NaN)', async () => {
      const feed = mockFeedWithScores({ 'im:rating': { label: 'not-a-number' } });
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(feed));

      const result = await reviews({ id: 553834731, page: 1 });

      expect(result).toHaveLength(1);
      expect(result[0]?.score).toBe(0);
    });

    it('clamps valid numeric ratings to 0–5', async () => {
      const feed = mockFeedWithScores(
        { 'im:rating': { label: '1' } },
        { 'im:rating': { label: '3' } },
        { 'im:rating': { label: '5' } },
        { 'im:rating': { label: '0' } },
        { 'im:rating': { label: '10' } }
      );
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(feed));

      const result = await reviews({ id: 553834731, page: 1 });

      expect(result).toHaveLength(5);
      expect(result[0]?.score).toBe(1);
      expect(result[1]?.score).toBe(3);
      expect(result[2]?.score).toBe(5);
      expect(result[3]?.score).toBe(0); // 0 left as 0
      expect(result[4]?.score).toBe(5); // 10 clamped to 5
    });

    it('ensures no score is outside 0–5', async () => {
      const feed = mockFeedWithScores(
        {},
        { 'im:rating': { label: '' } },
        { 'im:rating': { label: '2' } }
      );
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(feed));

      const result = await reviews({ id: 553834731, page: 1 });

      for (const r of result) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(5);
        expect(Number.isNaN(r.score)).toBe(false);
      }
    });
  });
});
