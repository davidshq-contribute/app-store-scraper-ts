import { describe, it, expect } from 'vitest';
import { developer } from '../lib/developer.js';
import { runIntegrationTests } from './integration.js';

describe('developer', () => {
  it('should throw error when devId is missing', async () => {
    await expect(
      // @ts-expect-error intentional: test runtime validation of invalid options
      developer({})
    ).rejects.toThrow('devId is required');
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
