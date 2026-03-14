import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as common from '../lib/common.js';
import { app } from '../lib/app.js';
import { HttpError } from '../lib/errors.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { runIntegrationTests } from './integration.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn((...args: Parameters<typeof actual.doRequest>) => actual.doRequest(...args)),
    lookup: vi.fn((...args: Parameters<typeof actual.lookup>) => actual.lookup(...args)),
  };
});

vi.mock('../lib/ratings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/ratings.js')>();
  return {
    ...actual,
    ratings: vi.fn((...args: Parameters<typeof actual.ratings>) => actual.ratings(...args)),
  };
});

// Import after mock so we get the mocked module
import { ratings } from '../lib/ratings.js';

describe('app', () => {
  beforeEach(() => {
    vi.mocked(common.doRequest).mockReset();
  });

  it('should throw error when neither id nor appId is provided', async () => {
    await expect(app({})).rejects.toThrow('Either id or appId is required');
  });

  it('throws Error when lookup returns no results (by id)', async () => {
    vi.mocked(common.lookup).mockResolvedValueOnce([]);
    const err = await app({ id: 999999 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('App not found: 999999');
  });

  it('throws Error when lookup returns no results (by appId)', async () => {
    vi.mocked(common.lookup).mockResolvedValueOnce([]);
    const err = await app({ appId: 'com.nonexistent.fake' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('App not found: com.nonexistent.fake');
  });

  describe('fixture-based (no network)', () => {
    const baseApp = {
      id: 12345,
      appId: 'com.test.app',
      title: 'Test App',
      url: 'https://apps.apple.com/us/app/test/id12345',
      description: 'Desc',
      icon: 'https://example.com/icon.png',
      screenshots: [] as string[],
      ipadScreenshots: [] as string[],
      appletvScreenshots: [] as string[],
      developer: 'Dev',
      developerId: 1,
      developerUrl: 'https://example.com/dev',
      genreIds: [6014],
      genres: ['Games'],
      primaryGenre: 'Games',
      primaryGenreId: 6014,
      price: 0,
      currency: 'USD',
      free: true,
      score: 4.5,
      reviews: 100,
      currentVersionScore: 4.5,
      currentVersionReviews: 50,
      released: '2024-01-01',
      updated: '2024-06-01',
      version: '1.0',
      contentRating: '4+',
      languages: ['en'],
      size: 50000000,
      requiredOsVersion: '17.0',
      releaseNotes: 'Bug fixes',
      supportedDevices: ['iPhone', 'iPad'],
    };

    it('calls lookup with bundleId when appId is provided', async () => {
      vi.mocked(common.lookup).mockResolvedValueOnce([baseApp]);

      await app({ appId: 'com.test.app', country: DEFAULT_COUNTRY });

      expect(common.lookup).toHaveBeenCalledWith(
        'com.test.app',
        'bundleId',
        DEFAULT_COUNTRY,
        undefined,
        undefined
      );
    });

    it('calls lookup with id when id is provided', async () => {
      vi.mocked(common.lookup).mockResolvedValueOnce([baseApp]);

      await app({ id: 12345, country: DEFAULT_COUNTRY });

      expect(common.lookup).toHaveBeenCalledWith(
        12345,
        'id',
        DEFAULT_COUNTRY,
        undefined,
        undefined
      );
    });

    it('scrapes screenshots when iTunes API returns empty arrays', async () => {
      vi.mocked(common.lookup).mockResolvedValueOnce([baseApp]);
      const htmlWithScreenshots = `
        <ul class="shelf-grid__list shelf-grid__list--grid-type-ScreenshotPhone">
          <li><picture><source type="image/webp" srcset="https://is1-ssl.mzstatic.com/image/thumb/foo/100x100bb.webp 100w"></source></picture></li>
        </ul>
      `;
      vi.mocked(common.doRequest).mockResolvedValueOnce(htmlWithScreenshots);

      const result = await app({ id: 12345, country: DEFAULT_COUNTRY });

      expect(result.screenshots).toHaveLength(1);
      expect(result.screenshots[0]).toMatch(/392x696bb\.webp$/);
      expect(common.doRequest).toHaveBeenCalledWith(
        expect.stringContaining('/us/app/id12345'),
        undefined
      );
    });

    it('returns empty screenshots when scrape gets 404', async () => {
      vi.mocked(common.lookup).mockResolvedValueOnce([baseApp]);
      vi.mocked(common.doRequest).mockRejectedValueOnce(new HttpError('Not Found', 404));

      const result = await app({ id: 12345, country: DEFAULT_COUNTRY });

      expect(result.screenshots).toEqual([]);
      expect(result.ipadScreenshots).toEqual([]);
      expect(result.appletvScreenshots).toEqual([]);
    });

    it('throws when scrape gets non-404 error', async () => {
      vi.mocked(common.lookup).mockResolvedValueOnce([baseApp]);
      vi.mocked(common.doRequest).mockRejectedValueOnce(new HttpError('Server Error', 500));

      await expect(app({ id: 12345, country: DEFAULT_COUNTRY })).rejects.toThrow(HttpError);
    });

    it('merges histogram when includeRatings is true', async () => {
      vi.mocked(common.lookup).mockResolvedValueOnce([baseApp]);
      vi.mocked(ratings).mockResolvedValueOnce({
        ratings: 100,
        histogram: { 1: 5, 2: 10, 3: 20, 4: 30, 5: 35 },
      });

      const result = await app({ id: 12345, country: DEFAULT_COUNTRY, ratings: true });

      expect(result.histogram).toEqual({ 1: 5, 2: 10, 3: 20, 4: 30, 5: 35 });
    });

    it('continues without histogram when ratings returns 404', async () => {
      vi.mocked(common.lookup).mockResolvedValueOnce([baseApp]);
      vi.mocked(ratings).mockRejectedValueOnce(new HttpError('Not Found', 404));

      const result = await app({ id: 12345, country: DEFAULT_COUNTRY, ratings: true });

      expect(result.histogram).toBeUndefined();
      expect(result.id).toBe(12345);
    });

    it('continues without histogram when ratings returns 200 with empty body', async () => {
      vi.mocked(common.lookup).mockResolvedValueOnce([baseApp]);
      vi.mocked(ratings).mockRejectedValueOnce(new HttpError('No ratings data returned', 200));

      const result = await app({ id: 12345, country: DEFAULT_COUNTRY, ratings: true });

      expect(result.histogram).toBeUndefined();
      expect(result.id).toBe(12345);
    });

    it('throws when ratings returns non-404 / non–empty-body error', async () => {
      vi.mocked(common.lookup).mockResolvedValueOnce([baseApp]);
      vi.mocked(ratings).mockRejectedValueOnce(new HttpError('Server Error', 500));

      await expect(app({ id: 12345, country: DEFAULT_COUNTRY, ratings: true })).rejects.toThrow(
        HttpError
      );
    });
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
    it('should fetch app by numeric ID', { timeout: 10000 }, async () => {
      // Minecraft app ID
      const result = await app({ id: 479516143 });

      expect(result).toBeDefined();
      expect(result.id).toBe(479516143);
      expect(result.title).toBeDefined();
      expect(result.appId).toBeDefined();
      expect(result.developer).toBeDefined();
      expect(result.url).toBeDefined();
    });

    it('should fetch app by bundle ID', { timeout: 10000 }, async () => {
      // Minecraft bundle ID
      const result = await app({ appId: 'com.mojang.minecraftpe' });

      expect(result).toBeDefined();
      expect(result.appId).toBe('com.mojang.minecraftpe');
      expect(result.title).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.developer).toBeDefined();
    });

    it('should include ratings when ratings option is true', { timeout: 10000 }, async () => {
      const result = await app({ id: 479516143, ratings: true });

      expect(result).toBeDefined();
      expect(result.histogram).not.toBeNull();
      expect(result.histogram).toBeDefined();
      expect(Object.keys(result.histogram!).sort()).toEqual(['1', '2', '3', '4', '5']);
    });
  });
});
