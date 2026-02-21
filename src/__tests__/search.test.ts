import { describe, it, expect, vi } from 'vitest';
import { search } from '../lib/search.js';
import { runIntegrationTests } from './integration.js';
import * as common from '../lib/common.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn((url: string, opts?: unknown) =>
      actual.doRequest(url, opts as Parameters<typeof actual.doRequest>[1])
    ),
  };
});

describe('search', () => {

  it('should throw error when term is missing', async () => {
    await expect(
      search({ term: '' })
    ).rejects.toThrow('term is required');
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

    it('caps limit at 200 and warns when page * num > 200', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(
        JSON.stringify(validSearchResponse)
      );
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await search({ term: 'test', page: 5, num: 50 });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('page * num (250) exceeds iTunes Search API limit (200)')
      );
      const url = vi.mocked(common.doRequest).mock.calls[0]?.[0] ?? '';
      expect(url).toContain('limit=200');
      warnSpy.mockRestore();
    });
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
    it('should search for apps with a valid term', { timeout: 10000 }, async () => {
      const results = await search({
        term: 'minecraft',
        num: 5
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);

      if (results.length > 0 && typeof results[0] === 'object') {
        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('title');
        expect(results[0]).toHaveProperty('appId');
      }
    });

    it('should return only IDs when idsOnly is true', { timeout: 10000 }, async () => {
      const results = await search({
        term: 'minecraft',
        num: 5,
        idsOnly: true
      });

      expect(Array.isArray(results)).toBe(true);

      if (results.length > 0) {
        expect(typeof results[0]).toBe('number');
      }
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

      // Pages should have different results (if there are enough results)
      if (page1.length > 0 && page2.length > 0 &&
          typeof page1[0] === 'object' && typeof page2[0] === 'object') {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });
  });
});
