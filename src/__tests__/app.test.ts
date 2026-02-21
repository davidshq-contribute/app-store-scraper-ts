import { describe, it, expect, vi } from 'vitest';
import * as common from '../lib/common.js';
import { app } from '../lib/app.js';
import { runIntegrationTests } from './integration.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    lookup: vi.fn((...args: Parameters<typeof actual.lookup>) => actual.lookup(...args)),
  };
});

describe('app', () => {
  it('should throw error when neither id nor appId is provided', async () => {
    await expect(
      app({})
    ).rejects.toThrow('Either id or appId is required');
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
