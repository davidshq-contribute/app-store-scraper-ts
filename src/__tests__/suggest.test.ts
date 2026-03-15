import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
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
  beforeEach(() => {
    vi.mocked(common.doRequest).mockReset();
  });

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

  it('constructs correct URL with encoded term', async () => {
    const hintsXml = `<?xml version="1.0"?>
<plist version="1.0"><dict><key>title</key><string>Suggestions</string><key>hints</key><array><string>test</string></array></dict></plist>`;
    vi.mocked(common.doRequest).mockResolvedValueOnce(hintsXml);

    await suggest({ term: 'hello world' });

    expect(common.doRequest).toHaveBeenCalledWith(
      expect.stringContaining('https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints'),
      undefined
    );
    const url = vi.mocked(common.doRequest).mock.calls[0]![0];
    expect(url).toContain('clientApplication=Software');
    expect(url).toContain('term=hello+world');
  });

  it('returns empty array when arrayData is a raw string', async () => {
    // When plist.dict.array is a string instead of an object with a string key
    const xml = `<?xml version="1.0"?>
<plist version="1.0"><dict><key>title</key><string>Suggestions</string><key>hints</key><string>just a string</string></dict></plist>`;
    vi.mocked(common.doRequest).mockResolvedValueOnce(xml);

    const results = await suggest({ term: 'test' });
    expect(results).toEqual([]);
  });

  it('returns empty array when directStrings (string key) is undefined', async () => {
    // dict.array exists as an object but has no 'string' key
    const xml = `<?xml version="1.0"?>
<plist version="1.0"><dict><key>title</key><string>Suggestions</string><key>hints</key><array><integer>123</integer></array></dict></plist>`;
    vi.mocked(common.doRequest).mockResolvedValueOnce(xml);

    const results = await suggest({ term: 'test' });
    expect(results).toEqual([]);
  });

  it('filters out empty strings and non-strings from hints', async () => {
    // Build a response where the XML parser produces a mix of valid strings and edge cases
    const hintsXml = `<?xml version="1.0"?>
<plist version="1.0"><dict><key>title</key><string>Suggestions</string><key>hints</key><array><string>valid</string><string></string><string>also valid</string></array></dict></plist>`;
    vi.mocked(common.doRequest).mockResolvedValueOnce(hintsXml);

    const results = await suggest({ term: 'test' });
    expect(results).toEqual([{ term: 'valid' }, { term: 'also valid' }]);
    // Empty string should be filtered out
    expect(results).not.toContainEqual({ term: '' });
  });

  it('does not crash on malformed XML response', async () => {
    vi.mocked(common.doRequest).mockResolvedValueOnce('not xml at all {{{');

    // fast-xml-parser may parse this as something unexpected, or the schema may reject it
    // The key thing is it doesn't crash with an unhandled error — either returns [] or throws ValidationError
    try {
      const result = await suggest({ term: 'test' });
      expect(Array.isArray(result)).toBe(true);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });

  it('asserts ValidationError field is "term" when term is missing', async () => {
    const err = await suggest({ term: '' }).then(
      () => expect.fail('expected rejection'),
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).field).toBe('term');
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
