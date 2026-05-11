import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { similar, getLinkTypeFromHeadingText } from '../lib/similar.js';
import * as common from '../lib/common.js';
import type { App } from '../types/app.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { runIntegrationTests } from './integration.js';
import { HttpError } from '../lib/errors.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    fetchAppPage: vi.fn(),
    lookup: vi.fn(),
    resolveAppId: vi.fn(),
  };
});

/** Minimal App fixture for similar() HTML parsing tests. */
function minimalApp(id: number, title: string): App {
  return {
    id,
    appId: `com.test.app${id}`,
    title,
    url: `https://apps.apple.com/app/id${id}`,
    description: '',
    icon: '',
    genres: [],
    genreIds: [],
    primaryGenre: '',
    primaryGenreId: 0,
    contentRating: '',
    languages: [],
    size: 0,
    requiredOsVersion: '',
    released: '',
    updated: '',
    releaseNotes: '',
    version: '1.0',
    price: 0,
    currency: 'USD',
    free: true,
    developerId: 0,
    developer: '',
    developerUrl: '',
    score: 0,
    reviews: 0,
    currentVersionScore: 0,
    currentVersionReviews: 0,
    screenshots: [],
    ipadScreenshots: [],
    appletvScreenshots: [],
    supportedDevices: [],
  };
}

describe('similar', () => {
  it('should throw error when neither id nor appId is provided', async () => {
    await expect(similar({})).rejects.toThrow('Either id or appId is required');
  });

  describe('getLinkTypeFromHeadingText (section patterns)', () => {
    it('maps "customers also bought" to customers-also-bought', () => {
      expect(getLinkTypeFromHeadingText('customers also bought')).toBe('customers-also-bought');
      expect(getLinkTypeFromHeadingText('Customers Also Bought')).toBe('customers-also-bought');
    });

    it('maps "more from (this) developer" and "more by developer" to more-by-developer', () => {
      expect(getLinkTypeFromHeadingText('more from this developer')).toBe('more-by-developer');
      expect(getLinkTypeFromHeadingText('more from developer')).toBe('more-by-developer');
      expect(getLinkTypeFromHeadingText('More by developer')).toBe('more-by-developer');
    });

    it('maps "you might also like" to you-might-also-like', () => {
      expect(getLinkTypeFromHeadingText('you might also like')).toBe('you-might-also-like');
    });

    it('maps "similar apps" and "related apps" to similar-apps', () => {
      expect(getLinkTypeFromHeadingText('similar apps')).toBe('similar-apps');
      expect(getLinkTypeFromHeadingText('Related Apps')).toBe('similar-apps');
    });

    it('returns other for unrecognized heading text', () => {
      expect(getLinkTypeFromHeadingText('Other section')).toBe('other');
      expect(getLinkTypeFromHeadingText('')).toBe('other');
    });

    it('trims heading text before matching', () => {
      expect(getLinkTypeFromHeadingText('  customers also bought  ')).toBe('customers-also-bought');
    });
  });

  describe('fixture-based (no network)', () => {
    beforeEach(() => {
      vi.mocked(common.fetchAppPage).mockReset();
      vi.mocked(common.lookup).mockReset();
      vi.mocked(common.resolveAppId).mockReset();
    });

    it('extracts app ids and linkTypes from HTML snippet (section headings + app links)', async () => {
      const currentAppId = 999;
      const html = `
        <body>
          <h2>Customers Also Bought</h2>
          <a href="https://apps.apple.com/us/app/foo/id111">App 1</a>
          <a href="https://apps.apple.com/us/app/bar/id222">App 2</a>
          <h3>More from this developer</h3>
          <a href="/us/app/baz/id333">App 3</a>
        </body>
      `;
      vi.mocked(common.fetchAppPage).mockResolvedValueOnce(html);
      vi.mocked(common.lookup).mockResolvedValueOnce([
        minimalApp(111, 'App 1'),
        minimalApp(222, 'App 2'),
        minimalApp(333, 'App 3'),
      ]);

      const results = await similar({
        id: currentAppId,
        country: DEFAULT_COUNTRY,
        includeLinkType: true,
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        app: minimalApp(111, 'App 1'),
        linkType: 'customers-also-bought',
      });
      expect(results[1]).toEqual({
        app: minimalApp(222, 'App 2'),
        linkType: 'customers-also-bought',
      });
      expect(results[2]).toEqual({ app: minimalApp(333, 'App 3'), linkType: 'more-by-developer' });
    });

    it('returns [] when fetchAppPage returns null (app page not found)', async () => {
      vi.mocked(common.fetchAppPage).mockResolvedValueOnce(null);

      const results = await similar({ id: 999, country: DEFAULT_COUNTRY });

      expect(results).toEqual([]);
    });

    it('rethrows when fetchAppPage throws HttpError 500', async () => {
      const err = new HttpError('Internal Server Error', 500);
      vi.mocked(common.fetchAppPage).mockRejectedValueOnce(err);

      await expect(similar({ id: 999, country: DEFAULT_COUNTRY })).rejects.toThrow(err);
    });

    it('uses resolveAppId when appId provided and id is null', async () => {
      const resolvedId = 842842640;
      vi.mocked(common.resolveAppId).mockResolvedValueOnce(resolvedId);
      const html = `
        <body>
          <h2>Customers Also Bought</h2>
          <a href="https://apps.apple.com/us/app/foo/id111">App 1</a>
        </body>
      `;
      vi.mocked(common.fetchAppPage).mockResolvedValueOnce(html);
      vi.mocked(common.lookup).mockResolvedValueOnce([minimalApp(111, 'App 1')]);

      const results = await similar({
        appId: 'com.google.Docs',
        country: DEFAULT_COUNTRY,
      });

      expect(common.resolveAppId).toHaveBeenCalledWith({
        appId: 'com.google.Docs',
        country: DEFAULT_COUNTRY,
        requestOptions: undefined,
      });
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(minimalApp(111, 'App 1'));
    });

    it('throws HttpError preserving status when resolveAppId fails with HttpError', async () => {
      vi.mocked(common.resolveAppId).mockRejectedValueOnce(new HttpError('App not found', 404));

      const err = await similar({ appId: 'com.nonexistent.app', country: DEFAULT_COUNTRY }).catch(
        (e) => e
      );
      expect(err).toBeInstanceOf(HttpError);
      expect(err.message).toBe('Could not resolve app id "com.nonexistent.app": App not found');
      expect(err.status).toBe(404);
    });

    it('wraps non-HttpError with cause preserved', async () => {
      const originalError = new Error('Bundle not found');
      vi.mocked(common.resolveAppId).mockRejectedValueOnce(originalError);

      const err = await similar({ appId: 'com.test', country: DEFAULT_COUNTRY }).catch((e) => e);
      expect(err).not.toBeInstanceOf(HttpError);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Could not resolve app id "com.test": Bundle not found');
      expect(err.cause).toBe(originalError);
    });

    it('filters undefined apps from lookup when some IDs are not found (includeLinkType: false)', async () => {
      const html = `
        <body>
          <h2>Customers Also Bought</h2>
          <a href="https://apps.apple.com/us/app/foo/id111">App 1</a>
          <a href="https://apps.apple.com/us/app/bar/id222">App 2</a>
        </body>
      `;
      vi.mocked(common.fetchAppPage).mockResolvedValueOnce(html);
      // lookup returns only 1 of the 2 requested apps
      vi.mocked(common.lookup).mockResolvedValueOnce([minimalApp(111, 'App 1')]);

      const results = await similar({ id: 999, country: DEFAULT_COUNTRY });

      // App 222 was not found by lookup, so it should be filtered out
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(111);
    });

    it('returns plain App[] when includeLinkType is false (default)', async () => {
      const html = `
        <body>
          <h2>Customers Also Bought</h2>
          <a href="https://apps.apple.com/us/app/foo/id111">App 1</a>
          <a href="https://apps.apple.com/us/app/bar/id222">App 2</a>
        </body>
      `;
      vi.mocked(common.fetchAppPage).mockResolvedValueOnce(html);
      vi.mocked(common.lookup).mockResolvedValueOnce([
        minimalApp(111, 'App 1'),
        minimalApp(222, 'App 2'),
      ]);

      const results = await similar({ id: 999, country: DEFAULT_COUNTRY });

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(minimalApp(111, 'App 1'));
      expect(results[1]).toEqual(minimalApp(222, 'App 2'));
      expect(results[0]).not.toHaveProperty('linkType');
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
    });

    it('deduplicates results when HTML has duplicate app IDs in same section (includeLinkType: true)', async () => {
      const html = `
        <body>
          <h2>Customers Also Bought</h2>
          <a href="https://apps.apple.com/us/app/foo/id111">App 1</a>
          <a href="https://apps.apple.com/us/app/bar/id111">App 1 duplicate</a>
          <a href="https://apps.apple.com/us/app/baz/id222">App 2</a>
        </body>
      `;
      vi.mocked(common.fetchAppPage).mockResolvedValueOnce(html);
      vi.mocked(common.lookup).mockResolvedValueOnce([
        minimalApp(111, 'App 1'),
        minimalApp(222, 'App 2'),
      ]);

      const results = await similar({
        id: 999,
        country: DEFAULT_COUNTRY,
        includeLinkType: true,
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        app: minimalApp(111, 'App 1'),
        linkType: 'customers-also-bought',
      });
      expect(results[1]).toEqual({
        app: minimalApp(222, 'App 2'),
        linkType: 'customers-also-bought',
      });
    });

    it('returns [] when HTML has no similar section (empty entries early return)', async () => {
      const html = `
        <body>
          <h2>Unrelated Section</h2>
          <p>No app links here.</p>
        </body>
      `;
      vi.mocked(common.fetchAppPage).mockResolvedValueOnce(html);

      const results = await similar({ id: 999, country: DEFAULT_COUNTRY });

      expect(results).toEqual([]);
      expect(common.lookup).not.toHaveBeenCalled();
    });
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
    afterEach(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    beforeAll(async () => {
      const actual = await vi.importActual<typeof common>('../lib/common.js');
      vi.mocked(common.fetchAppPage).mockImplementation(actual.fetchAppPage);
      vi.mocked(common.lookup).mockImplementation(actual.lookup);
      vi.mocked(common.resolveAppId).mockImplementation(actual.resolveAppId);
    });

    it('should fetch similar apps by ID (Google Docs)', { timeout: 15000 }, async () => {
      // Google Docs app ID — default returns App[] (backward compatible)
      const results = await similar({ id: 842842640, country: DEFAULT_COUNTRY });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length, 'API returned no similar apps').toBeGreaterThan(0);

      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('appId');
      expect(results[0]!.id).not.toBe(842842640); // Should not include the original app
    });

    it(
      'should return SimilarApp[] with linkType when includeLinkType: true',
      { timeout: 15000 },
      async () => {
        const results = await similar({
          id: 842842640,
          country: DEFAULT_COUNTRY,
          includeLinkType: true,
        });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length, 'API returned no similar apps').toBeGreaterThan(0);

        const first = results[0]!;
        expect(first).toHaveProperty('app');
        expect(first).toHaveProperty('linkType');
        expect(first.app).toHaveProperty('id');
        expect(first.app).toHaveProperty('title');
        expect(typeof first.linkType).toBe('string');
      }
    );

    it('should fetch similar apps by bundle ID', { timeout: 15000 }, async () => {
      // Google Docs bundle ID
      const results = await similar({ appId: 'com.google.Docs', country: DEFAULT_COUNTRY });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length, 'API returned no similar apps').toBeGreaterThan(0);

      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('appId');
    });
  });
});
