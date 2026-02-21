import { describe, it, expect } from 'vitest';
import { similar } from '../lib/similar.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { runIntegrationTests } from './integration.js';

describe('similar', () => {
  it('should throw error when neither id nor appId is provided', async () => {
    await expect(
      similar({})
    ).rejects.toThrow('Either id or appId is required');
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
    it('should fetch similar apps by ID (Google Docs)', { timeout: 15000 }, async () => {
      // Google Docs app ID — default returns App[] (backward compatible)
      const results = await similar({ id: 842842640, country: DEFAULT_COUNTRY });

      expect(Array.isArray(results)).toBe(true);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('title');
        expect(results[0]).toHaveProperty('appId');
        expect(results[0]?.id).not.toBe(842842640); // Should not include the original app
      }
    });

    it('should return SimilarApp[] with linkType when includeLinkType: true', { timeout: 15000 }, async () => {
      const results = await similar({ id: 842842640, country: DEFAULT_COUNTRY, includeLinkType: true });

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        const first = results[0]!;
        expect(first).toHaveProperty('app');
        expect(first).toHaveProperty('linkType');
        expect(first.app).toHaveProperty('id');
        expect(first.app).toHaveProperty('title');
        expect(typeof first.linkType).toBe('string');
      }
    });

    it('should fetch similar apps by bundle ID', { timeout: 15000 }, async () => {
      // Google Docs bundle ID
      const results = await similar({ appId: 'com.google.Docs', country: DEFAULT_COUNTRY });

      expect(Array.isArray(results)).toBe(true);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('title');
        expect(results[0]).toHaveProperty('appId');
      }
    });
  });
});
