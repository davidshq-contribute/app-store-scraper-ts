import { describe, it, expect, vi, beforeAll } from 'vitest';
import { search } from '../lib/search.js';
import { device } from '../types/constants.js';
import { runIntegrationTests } from './integration.js';
import * as common from '../lib/common.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
  };
});

describe('search', () => {
  it('should throw error when term is missing', async () => {
    await expect(search({ term: '' })).rejects.toThrow('term is required');
  });

  it('throws for invalid num or page (non-positive)', async () => {
    await expect(search({ term: 'x', num: 0 })).rejects.toThrow('num must be a positive integer');
    await expect(search({ term: 'x', page: 0 })).rejects.toThrow('page must be a positive integer');
    await expect(search({ term: 'x', page: -1 })).rejects.toThrow(
      'page must be a positive integer'
    );
  });

  it('throws for invalid device', async () => {
    await expect(search({ term: 'x', device: 'invalid' as never })).rejects.toThrow(
      'Invalid device: "invalid"'
    );
  });

  it('sends entity=software by default', async () => {
    vi.mocked(common.doRequest).mockResolvedValueOnce(
      JSON.stringify({ resultCount: 0, results: [] })
    );
    await search({ term: 'test' });
    const calls = vi.mocked(common.doRequest).mock.calls;
    const url = calls[calls.length - 1]?.[0] ?? '';
    expect(url).toContain('entity=software');
  });

  it('sends entity from device option (iPad, Mac)', async () => {
    vi.mocked(common.doRequest).mockResolvedValueOnce(
      JSON.stringify({ resultCount: 0, results: [] })
    );
    await search({ term: 'test', device: device.IPAD });
    let calls = vi.mocked(common.doRequest).mock.calls;
    const ipadUrl = calls[calls.length - 1]?.[0] ?? '';
    expect(new URL(ipadUrl).searchParams.get('entity')).toBe('iPadSoftware');

    vi.mocked(common.doRequest).mockResolvedValueOnce(
      JSON.stringify({ resultCount: 0, results: [] })
    );
    await search({ term: 'test', device: device.MAC });
    calls = vi.mocked(common.doRequest).mock.calls;
    const macUrl = calls[calls.length - 1]?.[0] ?? '';
    expect(new URL(macUrl).searchParams.get('entity')).toBe('macSoftware');
  });

  it('returns only trackIds when idsOnly is true (unit)', async () => {
    const rawResponse = {
      resultCount: 3,
      results: [
        { kind: 'software', trackId: 123, trackName: 'App A', bundleId: 'com.a' },
        { kind: 'software', trackId: 456, trackName: 'App B', bundleId: 'com.b' },
        { kind: 'software', trackId: 789, trackName: 'App C', bundleId: 'com.c' },
      ],
    };
    vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(rawResponse));

    const results = await search({ term: 'test', num: 10, idsOnly: true });

    expect(results).toEqual([123, 456, 789]);
    expect(results.every((r) => typeof r === 'number')).toBe(true);
  });

  it('filters out undefined trackIds when idsOnly is true', async () => {
    const rawResponse = {
      resultCount: 3,
      results: [
        { kind: 'software', trackId: 111, trackName: 'A', bundleId: 'com.a' },
        { kind: 'software', trackId: undefined, trackName: 'B', bundleId: 'com.b' },
        { kind: 'software', trackId: 333, trackName: 'C', bundleId: 'com.c' },
      ],
    };
    vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(rawResponse));

    const results = await search({ term: 'test', num: 10, idsOnly: true });

    expect(results).toEqual([111, 333]);
  });

  it('applies cleanApp transformation to raw iTunes results', async () => {
    const rawResponse = {
      resultCount: 1,
      results: [
        {
          kind: 'software',
          trackId: 999,
          bundleId: 'com.example.raw',
          trackName: 'Raw App Title',
          trackViewUrl: 'https://apps.apple.com/app/id999',
          description: 'Raw description',
          artworkUrl512: 'https://example.com/512.png',
          artworkUrl100: 'https://example.com/100.png',
          genres: ['Games', 'Entertainment'],
          genreIds: [6014, 6016],
          primaryGenreName: 'Games',
          primaryGenreId: 6014,
          contentAdvisoryRating: '4+',
          languageCodesISO2A: ['en'],
          fileSizeBytes: 50000000,
          minimumOsVersion: '15.0',
          releaseDate: '2024-01-01T00:00:00Z',
          currentVersionReleaseDate: '2024-02-01T00:00:00Z',
          releaseNotes: 'Bug fixes',
          version: '1.0.0',
          price: 0,
          currency: 'USD',
          artistId: 12345,
          artistName: 'Dev Name',
          artistViewUrl: 'https://apps.apple.com/developer/id12345',
          sellerUrl: 'https://example.com',
          averageUserRating: 4.5,
          userRatingCount: 100,
          averageUserRatingForCurrentVersion: 4.5,
          userRatingCountForCurrentVersion: 50,
          screenshotUrls: ['https://example.com/s1.png'],
          ipadScreenshotUrls: [],
          appletvScreenshotUrls: [],
          supportedDevices: ['iPhone', 'iPad'],
        },
      ],
    };
    vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(rawResponse));

    const results = await search({ term: 'test', num: 10 });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    const app = results[0]!;
    expect(app).toHaveProperty('id', 999);
    expect(app).toHaveProperty('appId', 'com.example.raw');
    expect(app).toHaveProperty('title', 'Raw App Title');
    expect(app).toHaveProperty('url', 'https://apps.apple.com/app/id999');
    expect(app).not.toHaveProperty('trackId');
    expect(app).not.toHaveProperty('trackName');
    expect(app).not.toHaveProperty('bundleId');
  });

  describe('pagination cap (BUG-3)', () => {
    const validSearchResponse = {
      resultCount: 200,
      results: Array.from({ length: 200 }, (_, i) => ({
        kind: 'software',
        trackId: 1000 + i,
        trackName: `App ${i}`,
        bundleId: `com.example.app${i}`,
      })),
    };

    it('returns empty when requested page is beyond 200-item cap', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(validSearchResponse));

      // page 5, num 50 → offset 200, window 200–249; API returns at most 200 items → slice is empty
      const results = await search({ term: 'test', page: 5, num: 50 });

      const calls = vi.mocked(common.doRequest).mock.calls;
      const url = calls[calls.length - 1]?.[0] ?? '';
      expect(url).toContain('limit=200');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('returns at most 200 results when mock returns 200', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(validSearchResponse));

      const results = await search({ term: 'test', page: 1, num: 200 });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(200);
    });
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
    beforeAll(async () => {
      const actual = await vi.importActual<typeof common>('../lib/common.js');
      vi.mocked(common.doRequest).mockImplementation(actual.doRequest);
    });

    it('should search for apps with a valid term', { timeout: 10000 }, async () => {
      const results = await search({
        term: 'minecraft',
        num: 5,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length, 'API returned no results').toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);

      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('appId');
    });

    it('should return only IDs when idsOnly is true', { timeout: 10000 }, async () => {
      const results = await search({
        term: 'minecraft',
        num: 5,
        idsOnly: true,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length, 'API returned no results').toBeGreaterThan(0);
      expect(typeof results[0]).toBe('number');
    });

    it('should respect pagination', { timeout: 10000 }, async () => {
      const page1 = await search({
        term: 'game',
        num: 5,
        page: 1,
      });

      const page2 = await search({
        term: 'game',
        num: 5,
        page: 2,
      });

      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);
      expect(page1.length, 'API returned no results for page 1').toBeGreaterThan(0);
      expect(page2.length, 'API returned no results for page 2').toBeGreaterThan(0);

      expect(page1[0]).toHaveProperty('id');
      expect(page2[0]).toHaveProperty('id');
      expect(page1[0]!.id).not.toBe(page2[0]!.id);
    });
  });
});
