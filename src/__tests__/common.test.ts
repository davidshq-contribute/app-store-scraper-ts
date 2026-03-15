import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  storeId,
  ensureArray,
  validateRequiredField,
  parseJson,
  resolveAppId,
  doRequest,
  safeParseInt,
  lookup,
  appPageUrl,
} from '../lib/common.js';
import { HttpError } from '../lib/errors.js';

/** Minimal iTunes lookup JSON so lookup() returns one app with the given trackId. */
function minimalLookupJson(trackId: number): string {
  return JSON.stringify({
    resultCount: 1,
    results: [{ kind: 'software', trackId, bundleId: 'com.test.app' }],
  });
}

/** Captures the error thrown by a synchronous function. */
function getError(fn: () => unknown): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error('Expected function to throw');
}

/** Helper to stub globalThis.fetch with a vi.fn() mock via vi.stubGlobal (auto-restored). */
function stubFetch(impl: ReturnType<typeof vi.fn> = vi.fn()): ReturnType<typeof vi.fn> {
  vi.stubGlobal('fetch', impl);
  return impl;
}

describe('common utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('appPageUrl', () => {
    it('builds exact App Store app page URL format', () => {
      expect(appPageUrl('us', 553834731)).toBe(
        'https://apps.apple.com/us/app/id553834731'
      );
      expect(appPageUrl('gb', 1)).toBe('https://apps.apple.com/gb/app/id1');
    });
  });

  describe('safeParseInt', () => {
    it('parses valid numbers and strings', () => {
      expect(safeParseInt(42)).toBe(42);
      expect(safeParseInt('123')).toBe(123);
      expect(safeParseInt('0')).toBe(0);
    });

    it('returns fallback for NaN', () => {
      expect(safeParseInt('abc')).toBe(0);
      expect(safeParseInt('abc', 99)).toBe(99);
      expect(safeParseInt('xyz', 42)).toBe(42);
      expect(safeParseInt(null)).toBe(0);
      expect(safeParseInt(undefined)).toBe(0);
    });

    it('returns custom fallback for nullish inputs', () => {
      const nullResult = safeParseInt(null, 99);
      const undefinedResult = safeParseInt(undefined, 99);
      expect(nullResult).toBe(99);
      expect(undefinedResult).toBe(99);
    });
  });

  describe('parseJson', () => {
    it('parses valid JSON and returns unknown', () => {
      expect(parseJson('{"a":1}')).toEqual({ a: 1 });
      expect(parseJson('null')).toBeNull();
      expect(parseJson('[1,2]')).toEqual([1, 2]);
    });

    it('throws HttpError on invalid JSON with body preview', () => {
      const body = 'not json at all';
      expect(() => parseJson(body)).toThrow(HttpError);
      expect(() => parseJson(body)).toThrow('Invalid JSON response');
      expect(() => parseJson(body)).toThrow('Body preview:');
      expect(() => parseJson(body)).toThrow(body);
    });

    it('defaults to status 200 when no context provided', () => {
      const err = getError(() => parseJson('x'));
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(200);
      expect(err.message).toContain('status 200');
    });

    it('uses provided status in error when given', () => {
      const err = getError(() => parseJson('x', { status: 500 }));
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(500);
      expect(err.message).toContain('status 500');
    });

    it('truncates long body in preview to 200 chars', () => {
      const long = 'x'.repeat(300);
      expect(() => parseJson(long)).toThrow('x'.repeat(200) + '...');
    });
  });

  describe('storeId', () => {
    it('should return store ID for valid country code', () => {
      expect(storeId('us')).toBe(143441);
      expect(storeId('gb')).toBe(143444);
      expect(storeId('ca')).toBe(143455);
    });

    it('should throw for unknown country code', () => {
      expect(() => storeId('xx')).toThrow('Unknown country code: xx');
    });

    it('should handle case-insensitive country codes', () => {
      expect(storeId('US')).toBe(143441);
      expect(storeId('Us')).toBe(143441);
      expect(storeId('gb')).toBe(143444);
    });
  });

  describe('ensureArray', () => {
    it('should return empty array for undefined', () => {
      expect(ensureArray(undefined)).toEqual([]);
    });

    it('should return empty array for null', () => {
      const result = ensureArray(null);
      expect(result).toEqual([]);
      expect(result).toStrictEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should wrap single value in array', () => {
      expect(ensureArray('test')).toEqual(['test']);
      expect(ensureArray(42)).toEqual([42]);
    });

    it('should return array as-is', () => {
      const arr = [1, 2, 3];
      const result = ensureArray(arr);
      expect(result).toBe(arr);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('resolveAppId', () => {
    it('returns numeric id when lookup finds the app', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(minimalLookupJson(553834731)),
      }));
      const id = await resolveAppId({ appId: 'com.example.app' });
      expect(id).toBe(553834731);
    });

    it('throws when lookup returns no results', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ resultCount: 0, results: [] })),
      }));
      const err = await resolveAppId({ appId: 'com.nonexistent.app' }).catch((e) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect(err.message).toBe('App not found: com.nonexistent.app');
      expect(err.status).toBe(404);
    });

    it('passes country and requestOptions to lookup', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(minimalLookupJson(1)),
      }));
      await resolveAppId({ appId: 'com.test', country: 'gb', requestOptions: { timeoutMs: 5000 } });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/itunes\.apple\.com\/lookup.*country=gb/),
        expect.any(Object)
      );
    });
  });

  describe('lookup', () => {
    it('builds lookup URL with bundleId parameter when idField is bundleId', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              resultCount: 1,
              results: [{ kind: 'software', trackId: 1, bundleId: 'com.test' }],
            })
          ),
      }));
      await lookup('com.test.app', 'bundleId', 'us');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/itunes\.apple\.com\/lookup\?.*bundleId=com\.test\.app/),
        expect.any(Object)
      );
    });

    it('builds lookup URL with id parameter when idField is id or artistId', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              resultCount: 1,
              results: [{ kind: 'software', trackId: 553834731 }],
            })
          ),
      }));
      await lookup(553834731, 'id', 'gb');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/itunes\.apple\.com\/lookup\?.*id=553834731/),
        expect.any(Object)
      );
      vi.mocked(fetch).mockClear();
      await lookup(12345, 'artistId', 'us');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/itunes\.apple\.com\/lookup\?.*id=12345/),
        expect.any(Object)
      );
    });

    it('includes entity=software and country in URL', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              resultCount: 1,
              results: [{ kind: 'software', trackId: 1 }],
            })
          ),
      }));
      await lookup(1, 'id', 'jp');
      const url = vi.mocked(fetch).mock.calls[0]![0] as string;
      expect(url).toContain('entity=software');
      expect(url).toContain('country=jp');
    });

    it('parses genreIds, primaryGenreId, size via safeParseInt', async () => {
      const json = JSON.stringify({
        resultCount: 1,
        results: [
          {
            kind: 'software',
            trackId: 123,
            bundleId: 'com.test.app',
            genreIds: [6014, '6001', 0],
            primaryGenreId: 6014,
            fileSizeBytes: '1024',
          },
        ],
      });
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(json),
      }));
      const apps = await lookup('com.test.app', 'bundleId');
      expect(apps).toHaveLength(1);
      expect(apps[0]!.genreIds).toEqual([6014, 6001]); // 0 filtered (Apple genre IDs are 6000+)
      expect(apps[0]!.primaryGenreId).toBe(6014);
      expect(apps[0]!.size).toBe(1024);
    });

    it('maps all cleanApp fields from full iTunes API response', async () => {
      const fullApp = {
        kind: 'software',
        trackId: 553834731,
        bundleId: 'com.midasplayer.apps.candycrushsaga',
        trackName: 'Candy Crush Saga',
        trackViewUrl: 'https://apps.apple.com/app/id553834731',
        description: 'Match candies to progress.',
        artworkUrl512: 'https://is1-ssl.mzstatic.com/512.png',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/100.png',
        genres: ['Games', 'Puzzle'],
        genreIds: [6014, 7012],
        primaryGenreName: 'Games',
        primaryGenreId: 6014,
        contentAdvisoryRating: '4+',
        languageCodesISO2A: ['en', 'es'],
        fileSizeBytes: '256000000',
        minimumOsVersion: '12.0',
        releaseDate: '2012-11-14T08:00:00Z',
        currentVersionReleaseDate: '2025-01-15T12:00:00Z',
        releaseNotes: 'Bug fixes.',
        version: '1.2.3',
        price: 0,
        currency: 'USD',
        artistId: 284882215,
        artistName: 'King',
        artistViewUrl: 'https://apps.apple.com/developer/king/id284882215',
        sellerUrl: 'https://king.com',
        averageUserRating: 4.5,
        userRatingCount: 1000000,
        averageUserRatingForCurrentVersion: 4.6,
        userRatingCountForCurrentVersion: 500000,
        screenshotUrls: ['https://example.com/s1.png'],
        ipadScreenshotUrls: ['https://example.com/ipad1.png'],
        appletvScreenshotUrls: [],
        supportedDevices: ['iPhone', 'iPad'],
      };
      const json = JSON.stringify({ resultCount: 1, results: [fullApp] });
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(json),
      }));
      const apps = await lookup(553834731, 'id');
      expect(apps).toHaveLength(1);
      const app = apps[0]!;
      expect(app.id).toBe(553834731);
      expect(app.appId).toBe('com.midasplayer.apps.candycrushsaga');
      expect(app.title).toBe('Candy Crush Saga');
      expect(app.url).toBe('https://apps.apple.com/app/id553834731');
      expect(app.description).toBe('Match candies to progress.');
      expect(app.icon).toBe('https://is1-ssl.mzstatic.com/512.png');
      expect(app.genres).toEqual(['Games', 'Puzzle']);
      expect(app.genreIds).toEqual([6014, 7012]);
      expect(app.primaryGenre).toBe('Games');
      expect(app.primaryGenreId).toBe(6014);
      expect(app.contentRating).toBe('4+');
      expect(app.languages).toEqual(['en', 'es']);
      expect(app.size).toBe(256000000);
      expect(app.requiredOsVersion).toBe('12.0');
      expect(app.released).toBe('2012-11-14T08:00:00Z');
      expect(app.updated).toBe('2025-01-15T12:00:00Z');
      expect(app.releaseNotes).toBe('Bug fixes.');
      expect(app.version).toBe('1.2.3');
      expect(app.price).toBe(0);
      expect(app.currency).toBe('USD');
      expect(app.free).toBe(true);
      expect(app.developerId).toBe(284882215);
      expect(app.developer).toBe('King');
      expect(app.developerUrl).toBe(
        'https://apps.apple.com/developer/king/id284882215'
      );
      expect(app.developerWebsite).toBe('https://king.com');
      expect(app.score).toBe(4.5);
      expect(app.reviews).toBe(1000000);
      expect(app.currentVersionScore).toBe(4.6);
      expect(app.currentVersionReviews).toBe(500000);
      expect(app.screenshots).toEqual(['https://example.com/s1.png']);
      expect(app.ipadScreenshots).toEqual(['https://example.com/ipad1.png']);
      expect(app.appletvScreenshots).toEqual([]);
      expect(app.supportedDevices).toEqual(['iPhone', 'iPad']);
    });

    it('uses artworkUrl100 when artworkUrl512 is missing (icon fallback)', async () => {
      const json = JSON.stringify({
        resultCount: 1,
        results: [
          {
            kind: 'software',
            trackId: 1,
            artworkUrl100: 'https://example.com/100.png',
          },
        ],
      });
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(json),
      }));
      const apps = await lookup(1, 'id');
      expect(apps[0]!.icon).toBe('https://example.com/100.png');
    });

    it('handles missing optional fields with defaults (optional chaining)', async () => {
      const json = JSON.stringify({
        resultCount: 1,
        results: [
          {
            kind: 'software',
            trackId: 999,
          },
        ],
      });
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(json),
      }));
      const apps = await lookup(999, 'id');
      expect(apps).toHaveLength(1);
      const app = apps[0]!;
      expect(app.appId).toBe('');
      expect(app.title).toBe('');
      expect(app.url).toBe('');
      expect(app.description).toBe('');
      expect(app.icon).toBe('');
      expect(app.genres).toEqual([]);
      expect(app.genreIds).toEqual([]);
      expect(app.primaryGenre).toBe('');
      expect(app.primaryGenreId).toBe(0);
      expect(app.contentRating).toBe('');
      expect(app.languages).toEqual([]);
      expect(app.size).toBe(0);
      expect(app.requiredOsVersion).toBe('');
      expect(app.released).toBe('');
      expect(app.updated).toBe('');
      expect(app.releaseNotes).toBe('');
      expect(app.version).toBe('');
      expect(app.price).toBe(0);
      expect(app.currency).toBe('USD');
      expect(app.free).toBe(true);
      expect(app.developerId).toBe(0);
      expect(app.developer).toBe('');
      expect(app.developerUrl).toBe('');
      expect(app.developerWebsite).toBeUndefined();
      expect(app.score).toBe(0);
      expect(app.reviews).toBe(0);
      expect(app.currentVersionScore).toBe(0);
      expect(app.currentVersionReviews).toBe(0);
      expect(app.screenshots).toEqual([]);
      expect(app.ipadScreenshots).toEqual([]);
      expect(app.appletvScreenshots).toEqual([]);
      expect(app.supportedDevices).toEqual([]);
    });

    it('filters to app records only (excludes artist records)', async () => {
      const json = JSON.stringify({
        resultCount: 4,
        results: [
          { kind: 'software', trackId: 1, bundleId: 'com.a' },
          { wrapperType: 'artist', artistId: 999, artistName: 'Artist' },
          { wrapperType: 'software', trackId: 2, bundleId: 'com.b' },
          { kind: 'mac-software', trackId: 3, bundleId: 'com.c' },
        ],
      });
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(json),
      }));
      const apps = await lookup(1, 'id');
      expect(apps).toHaveLength(3);
      expect(apps[0]!.id).toBe(1);
      expect(apps[1]!.id).toBe(2);
      expect(apps[2]!.id).toBe(3);
    });

    it('includes lang parameter when provided', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ resultCount: 0, results: [] })),
      }));
      await lookup(1, 'id', 'us', 'en');
      const url = vi.mocked(fetch).mock.calls[0]![0] as string;
      expect(url).toContain('lang=en');
    });

    it('does not include lang parameter when not provided', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ resultCount: 0, results: [] })),
      }));
      await lookup(1, 'id', 'us');
      const url = vi.mocked(fetch).mock.calls[0]![0] as string;
      expect(url).not.toContain('lang=');
    });

    it('cleanApp marks non-free app as free=false with correct price', async () => {
      const json = JSON.stringify({
        resultCount: 1,
        results: [
          { kind: 'software', trackId: 1, bundleId: 'com.paid', price: 4.99, currency: 'EUR' },
        ],
      });
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(json),
      }));
      const apps = await lookup(1, 'id');
      expect(apps[0]!.free).toBe(false);
      expect(apps[0]!.price).toBe(4.99);
      expect(apps[0]!.currency).toBe('EUR');
    });

    it('throws ValidationError when iTunes API response fails schema validation', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"not": "valid lookup response"}'),
      }));
      await expect(lookup(1, 'id')).rejects.toThrow('iTunes API response validation failed');
    });
  });

  describe('doRequest', () => {
    it('sends User-Agent header by default', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      }));
      await doRequest('https://example.com');
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla/5.0'),
          }),
        })
      );
    });

    it('returns response body verbatim on success', async () => {
      const bodyText = '{"resultCount":1,"results":[]}';
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(bodyText),
      }));
      const body = await doRequest('https://example.com');
      expect(body).toBe(bodyText);
    });

    it('throws immediately for non-retryable status codes (404)', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      }));
      const err = await doRequest('https://example.com', { retries: 2 }).catch(
        (e) => e
      );
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(404);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 503 and eventually succeeds', async () => {
      stubFetch(vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('success'),
        }));
      const body = await doRequest('https://example.com', { retries: 2 });
      expect(body).toBe('success');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 429 (throttle) and eventually succeeds', async () => {
      stubFetch(vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('ok'),
        }));
      const body = await doRequest('https://example.com', { retries: 2 });
      expect(body).toBe('ok');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('retries on TypeError (network error) and eventually succeeds', async () => {
      stubFetch(vi.fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('recovered'),
        }));
      const body = await doRequest('https://example.com', { retries: 1 });
      expect(body).toBe('recovered');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('throws TypeError when retries exhausted on network error', async () => {
      stubFetch(vi.fn()
        .mockRejectedValue(new TypeError('fetch failed')));
      const err = await doRequest('https://example.com', { retries: 1 }).catch((e) => e);
      expect(err).toBeInstanceOf(TypeError);
      expect(err.message).toBe('fetch failed');
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('doRequest retries clamp', () => {
    it('clamps retries: -1 to 0 and makes one request', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      }));
      const body = await doRequest('https://example.com', { retries: -1 });
      expect(body).toBe('ok');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('clamps retries: NaN to 0 and makes one request', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      }));
      const body = await doRequest('https://example.com', {
        retries: Number.NaN,
      });
      expect(body).toBe('ok');
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('doRequest timeoutMs validation', () => {
    it('throws clear error for timeoutMs <= 0', async () => {
      await expect(doRequest('https://example.com', { timeoutMs: 0 })).rejects.toThrow(
        'Invalid timeoutMs: must be a positive number, got 0'
      );
      await expect(doRequest('https://example.com', { timeoutMs: -1 })).rejects.toThrow(
        'Invalid timeoutMs: must be a positive number, got -1'
      );
    });

    it('throws clear error for timeoutMs NaN or Infinity', async () => {
      await expect(doRequest('https://example.com', { timeoutMs: Number.NaN })).rejects.toThrow(
        'Invalid timeoutMs: must be a positive number'
      );
      await expect(doRequest('https://example.com', { timeoutMs: Infinity })).rejects.toThrow(
        'Invalid timeoutMs: must be a positive number'
      );
    });

    it('accepts valid positive timeoutMs and makes request', async () => {
      stubFetch(vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      }));
      const body = await doRequest('https://example.com', { timeoutMs: 5000 });
      expect(body).toBe('ok');
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateRequiredField', () => {
    it('should not throw when required field is present', () => {
      expect(() => {
        validateRequiredField({ id: 123 }, ['id'], 'ID required');
      }).not.toThrow();
    });

    it('should not throw when one of multiple fields is present', () => {
      expect(() => {
        validateRequiredField(
          { id: undefined, appId: 'test' } as { id?: number; appId?: string },
          ['id', 'appId'],
          'Either id or appId required'
        );
      }).not.toThrow();
    });

    it('should throw when no required field is present', () => {
      expect(() => {
        validateRequiredField({ id: undefined } as { id?: number }, ['id'], 'ID required');
      }).toThrow('ID required');
    });

    it('should throw when none of multiple fields are present', () => {
      expect(() => {
        validateRequiredField(
          { id: undefined, appId: undefined } as { id?: number; appId?: string },
          ['id', 'appId'],
          'Either id or appId required'
        );
      }).toThrow('Either id or appId required');
    });

    it('should treat null as missing (require at least one non-null field)', () => {
      expect(() => {
        validateRequiredField(
          { id: null, appId: null },
          ['id', 'appId'],
          'Either id or appId required'
        );
      }).toThrow('Either id or appId required');
    });
  });
});
