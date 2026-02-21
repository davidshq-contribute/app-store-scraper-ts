/**
 * Schema validation tests using fixture data.
 * Prevents regressions when schemas change; no network required.
 */
import { describe, it, expect } from 'vitest';
import {
  iTunesLookupResponseSchema,
  reviewsFeedSchema,
  rssFeedSchema,
} from '../lib/schemas.js';

describe('iTunesLookupResponseSchema', () => {
  const validFixture = {
    resultCount: 1,
    results: [
      {
        trackId: 123,
        trackName: 'Test App',
        bundleId: 'com.example.app',
      },
    ],
  };

  it('succeeds on valid fixture', () => {
    const result = iTunesLookupResponseSchema.safeParse(validFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resultCount).toBe(1);
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0]?.trackName).toBe('Test App');
    }
  });

  it('fails when resultCount is missing', () => {
    const invalid = { results: [] };
    const result = iTunesLookupResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('fails when resultCount is wrong type', () => {
    const invalid = { resultCount: '1', results: [] };
    const result = iTunesLookupResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('fails when results is not an array', () => {
    const invalid = { resultCount: 0, results: 'not-array' };
    const result = iTunesLookupResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('rssFeedSchema', () => {
  const validFixtureEmpty = {};

  const validFixtureWithEntry = {
    feed: {
      entry: [
        {
          id: { attributes: { 'im:id': '123', 'im:bundleId': 'com.example.app' } },
          'im:name': { label: 'Test App' },
          'im:image': [{ label: 'https://example.com/icon.png' }],
        },
      ],
    },
  };

  it('succeeds on empty object (all optional)', () => {
    const result = rssFeedSchema.safeParse(validFixtureEmpty);
    expect(result.success).toBe(true);
  });

  it('succeeds on valid fixture with feed.entry array', () => {
    const result = rssFeedSchema.safeParse(validFixtureWithEntry);
    expect(result.success).toBe(true);
    if (result.success) {
      const entries = result.data.feed?.entry;
      const arr = Array.isArray(entries) ? entries : entries ? [entries] : [];
      expect(arr.length).toBeGreaterThan(0);
      expect(arr[0]?.['im:name']?.label).toBe('Test App');
    }
  });

  it('succeeds when entry has single im:image object (not array)', () => {
    const withSingleImage = {
      feed: {
        entry: [
          {
            id: { attributes: { 'im:id': '1', 'im:bundleId': 'com.x' } },
            'im:name': { label: 'App' },
            'im:image': { label: 'https://example.com/icon.png' },
          },
        ],
      },
    };
    const result = rssFeedSchema.safeParse(withSingleImage);
    expect(result.success).toBe(true);
    if (result.success) {
      const entries = result.data.feed?.entry;
      const arr = Array.isArray(entries) ? entries : entries ? [entries] : [];
      expect(arr[0]?.['im:image']).toEqual({ label: 'https://example.com/icon.png' });
    }
  });

  it('fails when feed is wrong type', () => {
    const invalid = { feed: 'not-an-object' };
    const result = rssFeedSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('fails when feed.entry is wrong type', () => {
    const invalid = { feed: { entry: 123 } };
    const result = rssFeedSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('reviewsFeedSchema', () => {
  const validFixtureEmpty = {};

  const validFixtureWithEntry = {
    feed: {
      entry: [
        {
          author: { name: { label: 'User' } },
          'im:rating': { label: '5' },
          title: { label: 'Great app' },
          content: { label: 'Review text' },
        },
      ],
    },
  };

  it('succeeds on empty object (all optional)', () => {
    const result = reviewsFeedSchema.safeParse(validFixtureEmpty);
    expect(result.success).toBe(true);
  });

  it('succeeds on valid fixture with feed.entry array', () => {
    const result = reviewsFeedSchema.safeParse(validFixtureWithEntry);
    expect(result.success).toBe(true);
    if (result.success) {
      const entries = result.data.feed?.entry;
      const arr = Array.isArray(entries) ? entries : entries ? [entries] : [];
      expect(arr.length).toBeGreaterThan(0);
      expect(arr[0]?.['im:rating']?.label).toBe('5');
    }
  });

  it('fails when feed is wrong type', () => {
    const invalid = { feed: null };
    const result = reviewsFeedSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('fails when feed.entry is wrong type', () => {
    const invalid = { feed: { entry: 'not-entry' } };
    const result = reviewsFeedSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
