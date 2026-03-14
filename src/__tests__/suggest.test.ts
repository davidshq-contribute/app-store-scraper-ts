import { describe, it, expect, vi, beforeAll } from 'vitest';
import { suggest } from '../lib/suggest.js';
import { ValidationError } from '../lib/errors.js';
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
  it('should throw ValidationError when term is missing', async () => {
    const err = await suggest({ term: '' }).then(
      () => expect.fail('expected rejection'),
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as Error).message).toBe('term is required');
  });

  describe('hints format', () => {
    const hintsXml = `<?xml version="1.0"?>
<plist version="1.0"><dict><key>title</key><string>Suggestions</string><key>hints</key><array><string>minecraft</string><string>minecraft pocket edition</string></array></dict></plist>`;

    it('parses hints array of strings', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(hintsXml);

      const results = await suggest({ term: 'min' });

      expect(results).toEqual([{ term: 'minecraft' }, { term: 'minecraft pocket edition' }]);
    });

    it('returns empty array when hints is empty', async () => {
      const emptyXml = `<?xml version="1.0"?>
<plist version="1.0"><dict><key>title</key><string>Suggestions</string><key>hints</key><array></array></dict></plist>`;
      vi.mocked(common.doRequest).mockResolvedValueOnce(emptyXml);

      const results = await suggest({ term: 'min' });

      expect(results).toEqual([]);
    });
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
    beforeAll(async () => {
      const actual = await vi.importActual<typeof common>('../lib/common.js');
      vi.mocked(common.doRequest).mockImplementation(actual.doRequest);
    });

    /**
     * Apple's suggest API currently returns empty hints for all requests (as of Feb 2025).
     * See docs/POSTPONED.md. When it returns data again, this test will pass.
     */
    it.skip('should return suggestions for a valid term', { timeout: 10000 }, async () => {
      const results = await suggest({ term: 'min' });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length, 'API returned no suggestions').toBeGreaterThan(0);

      const first = results[0]!;
      expect(first).toHaveProperty('term');
      expect(typeof first.term).toBe('string');
    });
  });
});
