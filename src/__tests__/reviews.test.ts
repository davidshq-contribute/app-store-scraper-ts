/**
 * Unit tests for reviews module.
 * BUG-1: Guards score parsing when im:rating is missing or unparseable (0 vs 1–5 contract).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reviews } from '../lib/reviews.js';
import * as common from '../lib/common.js';
import { sort as sortConstants } from '../types/constants.js';
import { ValidationError } from '../lib/errors.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
    resolveAppId: vi.fn(),
  };
});

describe('reviews', () => {
  beforeEach(() => {
    vi.mocked(common.doRequest).mockReset();
    vi.mocked(common.resolveAppId).mockReset();
  });

  it('should throw error when neither id nor appId is provided', async () => {
    const err = await reviews({} as Parameters<typeof reviews>[0]).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('Either id or appId is required');
    expect(err.field).toBe('id/appId');
  });

  it('throws ValidationError with field for invalid sort', async () => {
    const err = await reviews({ id: 123, sort: 'invalid' } as unknown as Parameters<typeof reviews>[0]).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.field).toBe('sort');
  });

  it('throws ValidationError with field for invalid country', async () => {
    const err = await reviews({ id: 123, country: 'xx' }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.field).toBe('country');
  });

  it('throws when page is out of range or non-integer', async () => {
    await expect(reviews({ id: 123, page: 0 })).rejects.toThrow(
      'page must be an integer between 1 and 10'
    );
    await expect(reviews({ id: 123, page: 11 })).rejects.toThrow(
      'page must be an integer between 1 and 10'
    );
    await expect(reviews({ id: 123, page: 1.5 })).rejects.toThrow(
      'page must be an integer between 1 and 10'
    );
  });

  describe('sort option and default', () => {
    const minimalFeed = {
      feed: {
        entry: [
          { id: { label: 'app-meta' }, title: { label: 'App' } },
          {
            id: { label: 'r1' },
            author: { name: { label: 'User' } },
            'im:version': { label: '1.0' },
            'im:rating': { label: '3' },
            title: { label: '' },
            content: { label: '' },
            updated: { label: '' },
          },
        ],
      },
    };

    it('uses default sort (RECENT) and includes sortby=mostRecent in URL', async () => {
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(minimalFeed));
      await reviews({ id: 553834731 });
      expect(common.doRequest).toHaveBeenCalledWith(
        expect.stringContaining('sortby=mostRecent'),
        undefined
      );
    });

    it('uses sort HELPFUL when specified and includes sortby=mostHelpful in URL', async () => {
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(minimalFeed));
      await reviews({ id: 553834731, sort: sortConstants.HELPFUL });
      expect(common.doRequest).toHaveBeenCalledWith(
        expect.stringContaining('sortby=mostHelpful'),
        undefined
      );
    });

    it('includes page and country in URL', async () => {
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(minimalFeed));
      await reviews({ id: 553834731, page: 2, country: 'gb' });
      expect(common.doRequest).toHaveBeenCalledWith(
        expect.stringMatching(/\/gb\/rss\/customerreviews\/page=2\/id=553834731\/sortby=mostRecent\/json/),
        undefined
      );
    });
  });

  describe('appId resolution path', () => {
    const minimalFeed = {
      feed: {
        entry: [
          { id: { label: 'app-meta' }, title: { label: 'App' } },
          {
            id: { label: 'r1' },
            author: { name: { label: 'User' } },
            'im:version': { label: '1.0' },
            'im:rating': { label: '4' },
            title: { label: '' },
            content: { label: '' },
            updated: { label: '' },
          },
        ],
      },
    };

    it('calls resolveAppId when appId is given and id is not', async () => {
      vi.mocked(common.resolveAppId).mockResolvedValue(553834731);
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(minimalFeed));

      const result = await reviews({ appId: 'com.example.app', country: 'us' });

      expect(common.resolveAppId).toHaveBeenCalledWith({
        appId: 'com.example.app',
        country: 'us',
        requestOptions: undefined,
      });
      expect(common.doRequest).toHaveBeenCalledWith(
        expect.stringContaining('id=553834731'),
        undefined
      );
      expect(result).toHaveLength(1);
    });

    it('throws with cause when resolveAppId fails', async () => {
      vi.mocked(common.resolveAppId).mockRejectedValue(new Error('App not found'));

      await expect(reviews({ appId: 'com.nonexistent.app' })).rejects.toThrow(
        'Could not resolve app id "com.nonexistent.app": App not found'
      );
    });
  });

  it('throws ValidationError when API response fails schema validation', async () => {
    // feed must be an object (or undefined), not a string — triggers schema failure
    vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify({ feed: 'not an object' }));

    await expect(reviews({ id: 553834731 })).rejects.toThrow(
      'Reviews API response validation failed'
    );
  });

  it('reviews error wrapping preserves cause', async () => {
    const originalError = new Error('App not found');
    vi.mocked(common.resolveAppId).mockRejectedValueOnce(originalError);

    const err = await reviews({ appId: 'com.test', page: 1 } as Parameters<typeof reviews>[0]).catch((e) => e);
    expect(err.cause).toBe(originalError);
  });

  describe('score parsing (BUG-1)', () => {
    /** Minimal feed valid for reviewsFeedSchema: first entry is app metadata (skipped), rest are reviews. */
    const mockFeedWithScores = (
      ...entries: Array<{
        'im:rating'?: { label?: string };
        id?: { label?: string };
        author?: { name?: { label?: string } };
        title?: { label?: string };
        content?: { label?: string };
        updated?: { label?: string };
        'im:version'?: { label?: string };
      }>
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

  /** Asserts mapping from feed entry to Review (userName, title, text, id, version, updated, userUrl). */
  describe('field mapping', () => {
    /** Feed with one review whose fields are set to distinct values to assert mapping. */
    const feedWithFullReview = {
      feed: {
        entry: [
          { id: { label: 'app-meta' }, title: { label: 'App' } },
          {
            id: { label: 'review-id-12345' },
            author: {
              name: { label: 'Jane Doe' },
              uri: { label: 'https://apps.apple.com/user/123' },
            },
            'im:version': { label: '2.1.0' },
            'im:rating': { label: '4' },
            title: { label: 'Great app' },
            content: { label: 'Really enjoying this so far.' },
            updated: { label: '2025-02-15T12:00:00-07:00' },
          },
        ],
      },
    };

    it('maps id, userName, userUrl, version, title, text, updated from feed entry', async () => {
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(feedWithFullReview));

      const result = await reviews({ id: 553834731, page: 1 });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'review-id-12345',
        userName: 'Jane Doe',
        userUrl: 'https://apps.apple.com/user/123',
        version: '2.1.0',
        score: 4,
        title: 'Great app',
        text: 'Really enjoying this so far.',
        updated: '2025-02-15T12:00:00-07:00',
      });
    });

    it('uses empty strings when optional feed fields are missing (optional chaining)', async () => {
      const feedWithMissingFields = {
        feed: {
          entry: [
            { id: { label: 'app-meta' }, title: { label: 'App' } },
            {
              id: {},
              author: {},
              'im:version': {},
              'im:rating': { label: '2' },
              title: {},
              content: {},
              updated: {},
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValue(JSON.stringify(feedWithMissingFields));

      const result = await reviews({ id: 553834731, page: 1 });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '',
        userName: '',
        userUrl: '',
        version: '',
        score: 2,
        title: '',
        text: '',
        updated: '',
      });
    });
  });
});
