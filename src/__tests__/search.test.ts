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
    await expect(
      search({ term: '' })
    ).rejects.toThrow('term is required');
  });

  it('throws for invalid num or page (non-positive)', async () => {
    await expect(search({ term: 'x', num: 0 })).rejects.toThrow('num must be a positive integer');
    await expect(search({ term: 'x', page: 0 })).rejects.toThrow('page must be a positive integer');
    await expect(search({ term: 'x', page: -1 })).rejects.toThrow('page must be a positive integer');
  });

  it('throws for invalid device', async () => {
    await expect(search({ term: 'x', device: 'invalid' as never })).rejects.toThrow('Invalid device: "invalid"');
  });

  it('sends entity=software by default', async () => {
    vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify({ resultCount: 0, results: [] }));
    await search({ term: 'test' });
    const calls = vi.mocked(common.doRequest).mock.calls;
    const url = calls[calls.length - 1]?.[0] ?? '';
    expect(url).toContain('entity=software');
  });

  it('sends entity from device option (iPad, Mac)', async () => {
    vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify({ resultCount: 0, results: [] }));
    await search({ term: 'test', device: device.IPAD });
    let calls = vi.mocked(common.doRequest).mock.calls;
    expect(calls[calls.length - 1]?.[0]).toContain('entity=iPadSoftware');

    vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify({ resultCount: 0, results: [] }));
    await search({ term: 'test', device: device.MAC });
    calls = vi.mocked(common.doRequest).mock.calls;
    expect(calls[calls.length - 1]?.[0]).toContain('entity=macSoftware');
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
      vi.mocked(common.doRequest).mockResolvedValueOnce(
        JSON.stringify(validSearchResponse)
      );

      // page 5, num 50 → offset 200, window 200–249; API returns at most 200 items → slice is empty
      const results = await search({ term: 'test', page: 5, num: 50 });

      const calls = vi.mocked(common.doRequest).mock.calls;
      const url = calls[calls.length - 1]?.[0] ?? '';
      expect(url).toContain('limit=200');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('returns at most 200 results when mock returns 200', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(
        JSON.stringify(validSearchResponse)
      );

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
        num: 5
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
        idsOnly: true
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length, 'API returned no results').toBeGreaterThan(0);
      expect(typeof results[0]).toBe('number');
    });

    it('should respect pagination', { timeout: 10000 }, async () => {
      const page1 = await search({
        term: 'game',
        num: 5,
        page: 1
      });

      const page2 = await search({
        term: 'game',
        num: 5,
        page: 2
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
