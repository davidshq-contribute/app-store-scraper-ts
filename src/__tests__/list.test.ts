import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { list } from '../lib/list.js';
import * as common from '../lib/common.js';
import { collection, DEFAULT_COUNTRY } from '../types/constants.js';
import { runIntegrationTests } from './integration.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
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
              link: [{ attributes: { href: 'https://apps.apple.com/us/app/x/id111', rel: 'alternate' } }],
              'im:price': { attributes: { amount: '0', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': { label: 'Dev', attributes: { href: 'https://apps.apple.com/us/developer/x/id1' } },
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
              link: [{ attributes: { href: 'https://apps.apple.com/us/app/x/id42', rel: 'alternate' } }],
              'im:price': { attributes: { amount: 'free', currency: 'USD' } },
              summary: { label: 'Desc' },
              'im:artist': { label: 'Dev', attributes: { href: 'https://apps.apple.com/us/developer/x/id1' } },
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

    it('parses developerId correctly when developer slug contains "id" (e.g. identity-games)', async () => {
      const minimalRss = {
        feed: {
          entry: [
            {
              id: { attributes: { 'im:id': '1', 'im:bundleId': 'com.test.app' } },
              'im:name': { label: 'Test' },
              'im:image': [{ label: 'https://example.com/icon.png' }],
              link: [{ attributes: { href: 'https://apps.apple.com/us/app/x/id1', rel: 'alternate' } }],
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
