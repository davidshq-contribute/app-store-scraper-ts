import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { list } from '../lib/list.js';
import * as common from '../lib/common.js';
import { collection, category, DEFAULT_COUNTRY } from '../types/constants.js';
import { runIntegrationTests } from './integration.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
    lookup: vi.fn(),
  };
});

describe('list', () => {
  describe('validation', () => {
    it('throws for invalid num (negative or out of range)', async () => {
      await expect(list({ num: -1 })).rejects.toThrow('num must be an integer between 1 and 200');
      await expect(list({ num: 0 })).rejects.toThrow('num must be an integer between 1 and 200');
      await expect(list({ num: 201 })).rejects.toThrow('num must be an integer between 1 and 200');
    });
  });

  describe('fixture-based (no network)', () => {
    beforeEach(() => {
      vi.mocked(common.doRequest).mockReset();
      vi.mocked(common.lookup).mockReset();
    });

    it('returns ListApp[] from minimal RSS fixture and exercises parseEntryLink/parseDeveloperIdFromHref', async () => {
      const appUrl = 'https://apps.apple.com/us/app/some-app/id123456789';
      const developerHref = 'https://apps.apple.com/us/developer/foo/id999?mt=8';
      const minimalRss = {
        feed: {
          entry: [
            {
              id: {
                attributes: {
                  'im:id': '123456789',
                  'im:bundleId': 'com.example.app',
                },
              },
              'im:name': { label: 'Example App' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://other.com', rel: 'enclosure' } },
                { attributes: { href: appUrl, rel: 'alternate' } },
              ],
              'im:price': {
                attributes: { amount: '0', currency: 'USD' },
              },
              summary: { label: 'Short description' },
              'im:artist': {
                label: 'Example Dev',
                attributes: { href: developerHref },
              },
              category: {
                attributes: { label: 'Games', 'im:id': '6014' },
              },
              'im:releaseDate': { label: '2024-01-15T00:00:00-07:00' },
            },
          ],
        },
      };

      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      const app = results[0]!;
      expect(app.id).toBe(123456789);
      expect(app.appId).toBe('com.example.app');
      expect(app.title).toBe('Example App');
      expect(app.price).toBe(0);
      expect(app.currency).toBe('USD');
      expect(app.free).toBe(true);
      expect(app.description).toBe('Short description');
      expect(app.developer).toBe('Example Dev');
      expect(app.developerUrl).toBe(developerHref);
      expect(app.developerId).toBe(999);
      expect(app.genre).toBe('Games');
      expect(app.genreId).toBe(6014);
      expect(app.released).toBe('2024-01-15T00:00:00-07:00');
      expect(app.icon).toBe('https://example.com/icon.png');
      expect(app.url).toBe(appUrl);
    });

    it('accepts single im:image object (not array)', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '111', 'im:bundleId': 'com.single-image.app' } },
              'im:name': { label: 'Single Image App' },
              'im:image': { label: 'https://example.com/single-icon.png' },
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/x/id111', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.icon).toBe('https://example.com/single-icon.png');
    });

    it('treats non-numeric price amount (e.g. "free") as 0 and free: true', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '42', 'im:bundleId': 'com.free.app' } },
              'im:name': { label: 'Free App' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/x/id42', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: 'free', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.price).toBe(0);
      expect(results[0]!.free).toBe(true);
    });

    it('returns empty array when feed has no entries (feed.entry undefined)', async () => {
      const emptyFeed = { feed: {} };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(emptyFeed));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toEqual([]);
    });

    it('returns empty array when feed.entry is empty array', async () => {
      const emptyFeed = { feed: { entry: [] } };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(emptyFeed));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toEqual([]);
    });

    it('constructs URL with collection, category, country, and limit', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '1', 'im:bundleId': 'com.test' } },
              'im:name': { label: 'Test' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/x/id1', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      await list({
        collection: collection.TOP_GROSSING_IOS,
        category: category.GAMES,
        num: 25,
        country: 'gb',
      });

      expect(common.doRequest).toHaveBeenCalledTimes(1);
      const url = vi.mocked(common.doRequest).mock.calls[0]![0];
      expect(url).toContain('https://itunes.apple.com/gb/rss/topgrossingapplications');
      expect(url).toContain('genre=6014');
      expect(url).toContain('limit=25');
      expect(url).toMatch(/\/json$/);
    });

    it('parses link as single object (not array) and extracts alternate href', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '777', 'im:bundleId': 'com.single-link.app' } },
              'im:name': { label: 'Single Link App' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: {
                attributes: {
                  href: 'https://apps.apple.com/us/app/single/id777',
                  rel: 'alternate',
                },
              },
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.url).toBe('https://apps.apple.com/us/app/single/id777');
    });

    it('returns empty url when no link with rel=alternate', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '1', 'im:bundleId': 'com.no-link.app' } },
              'im:name': { label: 'No Link' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [{ attributes: { href: 'https://other.com', rel: 'enclosure' } }],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.url).toBe('');
    });

    it('returns developerId 0 when artist has no href', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '1', 'im:bundleId': 'com.test' } },
              'im:name': { label: 'Test' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/x/id1', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': { label: 'Dev' },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.developerId).toBe(0);
      expect(results[0]!.developerUrl).toBe('');
    });

    it('returns genreId 0 when category im:id is missing or invalid', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '1', 'im:bundleId': 'com.test' } },
              'im:name': { label: 'Test' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/x/id1', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.genreId).toBe(0);
      expect(results[0]!.genre).toBe('Games');
    });

    it('parses developerId correctly when developer slug contains "id" (e.g. identity-games)', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '1', 'im:bundleId': 'com.test.app' } },
              'im:name': { label: 'Test' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/x/id1', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Identity Games',
                attributes: {
                  href: 'https://apps.apple.com/us/developer/identity-games/id284882218',
                },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.developerId).toBe(284882218);
    });

    it('returns ListApp with paid app (free=false, correct price)', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '42', 'im:bundleId': 'com.paid.app' } },
              'im:name': { label: 'Paid App' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/x/id42', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '2.99', currency: 'EUR' } },
              summary: { label: 'A paid app' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Productivity', 'im:id': '6007' } },
              'im:releaseDate': { label: '2024-06-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(minimalRss));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.price).toBe(2.99);
      expect(results[0]!.currency).toBe('EUR');
      expect(results[0]!.free).toBe(false);
    });

    it('fullDetail=true extracts IDs from entries, calls lookup, returns App[]', async () => {
      const rssData = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '111', 'im:bundleId': 'com.a' } },
              'im:name': { label: 'A' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/a/id111', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
            {
              id: { attributes: { 'im:id': '222', 'im:bundleId': 'com.b' } },
              'im:name': { label: 'B' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/b/id222', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };

      // doRequest returns RSS feed
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(rssData));
      // lookup is called with extracted IDs and returns full App objects
      const fakeApps = [
        { id: 111, appId: 'com.a', title: 'App A', screenshots: [] },
        { id: 222, appId: 'com.b', title: 'App B', screenshots: [] },
      ];
      vi.mocked(common.lookup).mockResolvedValueOnce(fakeApps as never);

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        fullDetail: true,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(2);
      expect(results[0]!).toHaveProperty('screenshots'); // Full App shape
      expect(results[0]!.id).toBe(111);
      expect(results[1]!.id).toBe(222);
      // doRequest called once for RSS, lookup called once for full details
      expect(common.doRequest).toHaveBeenCalledTimes(1);
      expect(common.lookup).toHaveBeenCalledTimes(1);
      expect(common.lookup).toHaveBeenCalledWith(
        [111, 222],
        'id',
        DEFAULT_COUNTRY,
        undefined,
        undefined
      );
    });

    it('fullDetail=true returns empty and warns when all entry IDs are invalid', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const rssData = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:bundleId': 'com.noid' } },
              'im:name': { label: 'No ID' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/x/id1', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(rssData));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        fullDetail: true,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toEqual([]);
      // Only RSS feed request, no lookup since no valid IDs
      expect(common.doRequest).toHaveBeenCalledTimes(1);
      expect(common.lookup).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'list(): skipped 1 feed entries with missing or invalid id'
      );
      warnSpy.mockRestore();
    });

    it('warns when entries are skipped in light mode (fullDetail=false)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const rssData = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '1', 'im:bundleId': 'com.valid' } },
              'im:name': { label: 'Valid' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [
                { attributes: { href: 'https://apps.apple.com/us/app/x/id1', rel: 'alternate' } },
              ],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': {
                label: 'Dev',
                attributes: { href: 'https://apps.apple.com/us/developer/x/id1' },
              },
              category: { attributes: { label: 'Games', 'im:id': '6014' } },
              'im:releaseDate': { label: '2024-01-01T00:00:00Z' },
            },
            {
              id: { attributes: { 'im:bundleId': 'com.noid' } },
              'im:name': { label: 'Missing ID' },
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(rssData));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'list(): skipped 1 feed entries with missing or invalid id'
      );
      warnSpy.mockRestore();
    });

    it('list entry with missing optional fields falls back to empty strings', async () => {
      const rssData = {
        feed: {
          entry: [
            {
              // Must have im:id to not be null-filtered
              id: { attributes: { 'im:id': '1' } },
              // All other fields missing
            },
          ],
        },
      };
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify(rssData));

      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 10,
        country: DEFAULT_COUNTRY,
      });

      expect(results).toHaveLength(1);
      const app = results[0]!;
      expect(app.id).toBe(1);
      expect(app.appId).toBe('');
      expect(app.title).toBe('');
      expect(app.description).toBe('');
      expect(app.developer).toBe('');
      expect(app.developerUrl).toBe('');
      expect(app.icon).toBe('');
      expect(app.genre).toBe('');
      expect(app.released).toBe('');
      expect(app.url).toBe('');
      expect(app.price).toBe(0);
      expect(app.free).toBe(true);
      expect(app.currency).toBe('USD');
      expect(app.developerId).toBe(0);
      expect(app.genreId).toBe(0);
    });

    it('throws ValidationError when RSS response fails schema validation', async () => {
      // feed must be an object (or undefined), not a string — this triggers schema failure
      vi.mocked(common.doRequest).mockResolvedValueOnce(JSON.stringify({ feed: 'not an object' }));

      await expect(
        list({ collection: collection.TOP_FREE_IOS, num: 10, country: DEFAULT_COUNTRY })
      ).rejects.toThrow('List API response validation failed');
    });
  });

  describe('allowlist validation', () => {
    beforeEach(() => {
      vi.mocked(common.doRequest).mockReset();
    });

    it('throws for invalid country before making any request', async () => {
      await expect(list({ country: 'xx', num: 1 })).rejects.toThrow('Invalid country: "xx"');
      expect(common.doRequest).not.toHaveBeenCalled();
    });

    it('throws for invalid collection before making any request', async () => {
      await expect(
        list({ country: DEFAULT_COUNTRY, collection: 'invalid' as never, num: 1 })
      ).rejects.toThrow('Invalid collection: "invalid"');
      expect(common.doRequest).not.toHaveBeenCalled();
    });

    it('throws for invalid category before making any request', async () => {
      await expect(
        list({ country: DEFAULT_COUNTRY, category: 99999 as never, num: 1 })
      ).rejects.toThrow('Invalid category: 99999');
      expect(common.doRequest).not.toHaveBeenCalled();
    });
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
    beforeAll(async () => {
      const actual = await vi.importActual<typeof common>('../lib/common.js');
      vi.mocked(common.doRequest).mockImplementation(actual.doRequest);
      vi.mocked(common.lookup).mockImplementation(actual.lookup);
    });

    it('returns ListApp[] when fullDetail is false (default)', { timeout: 10000 }, async () => {
      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 5,
        country: DEFAULT_COUNTRY,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);

      const first = results[0]!;
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('appId');
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('icon');
      expect(first).toHaveProperty('url');
      expect(first).toHaveProperty('price');
      expect(first).toHaveProperty('currency');
      expect(first).toHaveProperty('free');
      expect(first).toHaveProperty('description');
      expect(first).toHaveProperty('developer');
      expect(first).toHaveProperty('developerUrl');
      expect(first).toHaveProperty('developerId');
      expect(first).toHaveProperty('genre');
      expect(first).toHaveProperty('genreId');
      expect(first).toHaveProperty('released');
      expect(typeof first.id).toBe('number');
      expect(typeof first.genreId).toBe('number');
      expect(typeof first.developerId).toBe('number');
      expect(typeof first.free).toBe('boolean');
    });

    it('returns App[] when fullDetail is true', { timeout: 15000 }, async () => {
      const results = await list({
        collection: collection.TOP_FREE_IOS,
        num: 3,
        fullDetail: true,
        country: DEFAULT_COUNTRY,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const first = results[0];
      expect(first).toHaveProperty('screenshots');
      expect(first).toHaveProperty('score');
      expect(first).toHaveProperty('version');
      expect(Array.isArray((first as { screenshots: unknown }).screenshots)).toBe(true);
    });
  });
});
