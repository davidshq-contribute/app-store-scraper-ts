import { describe, it, expect, vi, beforeAll } from 'vitest';
import { suggest } from '../lib/suggest.js';
import { runIntegrationTests } from './integration.js';
import * as common from '../lib/common.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
  };
});

describe('suggest', () => {
  it('should throw error when term is missing', async () => {
    await expect(suggest({ term: '' })).rejects.toThrow('term is required');
  });

  describe('single-dict response', () => {
    /**
     * API can return a single <dict> when there is one suggestion instead of an array.
     * Parsed structure: plist.dict.array.dict = { string: "minecraft" } (object, not array).
     */
    const singleDictXml = `<?xml version="1.0"?>
<plist><dict><array><dict><string>minecraft</string></dict></array></dict></plist>`;

    it('normalizes single-dict response to one suggestion', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(singleDictXml);

      const results = await suggest({ term: 'min' });

      expect(results).toEqual([{ term: 'minecraft' }]);
    });
  });

  describe('array response', () => {
    /**
     * When there are multiple suggestions, API returns multiple <dict> elements;
     * parser yields array: plist.dict.array.dict = [ { string: "a" }, { string: "b" } ].
     */
    const arrayDictXml = `<?xml version="1.0"?>
<plist><dict><array><dict><string>minecraft</string></dict><dict><string>minecraft pocket edition</string></dict></array></dict></plist>`;

    it('handles array of dicts as before', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(arrayDictXml);

      const results = await suggest({ term: 'min' });

      expect(results).toEqual([
        { term: 'minecraft' },
        { term: 'minecraft pocket edition' },
      ]);
    });
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
    beforeAll(async () => {
      const actual = await vi.importActual<typeof common>('../lib/common.js');
      vi.mocked(common.doRequest).mockImplementation(actual.doRequest);
    });

    it('should return suggestions for a valid term', { timeout: 10000 }, async () => {
      const results = await suggest({ term: 'min' });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length, 'API returned no suggestions').toBeGreaterThan(0);

      const first = results[0]!;
      expect(first).toHaveProperty('term');
      expect(typeof first.term).toBe('string');
    });
  });
});
