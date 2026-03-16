import { describe, it, expect, vi, afterEach } from 'vitest';
import { developer } from '../lib/developer.js';
import { ValidationError } from '../lib/errors.js';
import { runIntegrationTests } from './integration.js';

describe('developer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should throw error when devId is missing', async () => {
    await expect(
      // @ts-expect-error intentional: test runtime validation of invalid options
      developer({})
    ).rejects.toThrow('devId is required');
  });

  it('throws ValidationError with field "devId" when devId is missing', async () => {
    const err = await developer({} as Parameters<typeof developer>[0]).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).field).toBe('devId');
  });

  it('calls lookup with artistId field', async () => {
    const lookupResponse = {
      resultCount: 1,
      results: [{ kind: 'software', trackId: 100, bundleId: 'com.test', artistId: 12345 }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(lookupResponse)),
      })
    );

    await developer({ devId: 12345 });
    // artistId should map to 'id' param in URL (not 'artistId')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/itunes\.apple\.com\/lookup\?.*id=12345/),
      expect.any(Object)
    );
    // Should also contain entity=software
    const url = vi.mocked(fetch).mock.calls[0]![0] as string;
    expect(url).toContain('entity=software');
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
    it('should fetch apps by developer ID (Google)', { timeout: 10000 }, async () => {
      // Google's developer ID
      const results = await developer({ devId: 281956209 });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // All results should be apps from Google
      results.forEach((app) => {
        expect(app.developerId).toBe(281956209);
        expect(app.developer).toBe('Google');
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('title');
        expect(app).toHaveProperty('appId');
      });
    });

    it('should fetch apps by developer ID (Mojang)', { timeout: 10000 }, async () => {
      // Mojang's developer ID (artistId), not Minecraft's trackId (479516143)
      const results = await developer({ devId: 479516146 });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // All results should be apps from Mojang
      results.forEach((app) => {
        expect(app.developerId).toBe(479516146);
        expect(app.developer).toBe('Mojang');
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('title');
        expect(app).toHaveProperty('appId');
      });
    });
  });
});
