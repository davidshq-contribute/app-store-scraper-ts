import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  storeId,
  ensureArray,
  validateRequiredField,
  parseJson,
  resolveAppId,
  doRequest,
} from '../lib/common.js';

/** Minimal iTunes lookup JSON so lookup() returns one app with the given trackId. */
function minimalLookupJson(trackId: number): string {
  return JSON.stringify({
    resultCount: 1,
    results: [{ kind: 'software', trackId, bundleId: 'com.test.app' }],
  });
}

describe('common utilities', () => {
  describe('parseJson', () => {
    it('parses valid JSON and returns unknown', () => {
      expect(parseJson('{"a":1}')).toEqual({ a: 1 });
      expect(parseJson('null')).toBeNull();
      expect(parseJson('[1,2]')).toEqual([1, 2]);
    });

    it('throws clear error on invalid JSON with body preview', () => {
      const body = 'not json at all';
      expect(() => parseJson(body)).toThrow('Invalid JSON response');
      expect(() => parseJson(body)).toThrow('Body preview:');
      expect(() => parseJson(body)).toThrow(body);
    });

    it('includes optional status in error when provided', () => {
      expect(() => parseJson('x', { status: 500 })).toThrow('status 500');
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

    it('should return US store ID for unknown country', () => {
      expect(storeId('xx')).toBe(143441);
    });

    it('should handle case-insensitive country codes', () => {
      expect(storeId('US')).toBe(143441);
      expect(storeId('Us')).toBe(143441);
    });
  });

  describe('ensureArray', () => {
    it('should return empty array for undefined', () => {
      expect(ensureArray(undefined)).toEqual([]);
    });

    it('should return empty array for null', () => {
      expect(ensureArray(null)).toEqual([]);
    });

    it('should wrap single value in array', () => {
      expect(ensureArray('test')).toEqual(['test']);
      expect(ensureArray(42)).toEqual([42]);
    });

    it('should return array as-is', () => {
      const arr = [1, 2, 3];
      expect(ensureArray(arr)).toBe(arr);
    });
  });

  describe('resolveAppId', () => {
    const originalFetch = globalThis.fetch;
    beforeEach(() => {
      globalThis.fetch = originalFetch;
    });
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns numeric id when lookup finds the app', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(minimalLookupJson(553834731)),
      }) as typeof fetch;
      const id = await resolveAppId({ appId: 'com.example.app' });
      expect(id).toBe(553834731);
    });

    it('throws when lookup returns no results', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ resultCount: 0, results: [] })),
      }) as typeof fetch;
      await expect(resolveAppId({ appId: 'com.nonexistent.app' })).rejects.toThrow('App not found: com.nonexistent.app');
    });

    it('passes country and requestOptions to lookup', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(minimalLookupJson(1)),
      }) as typeof fetch;
      await resolveAppId({ appId: 'com.test', country: 'gb', requestOptions: { timeoutMs: 5000 } });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/itunes\.apple\.com\/lookup.*country=gb/),
        expect.any(Object)
      );
    });
  });

  describe('doRequest retries clamp', () => {
    const originalFetch = globalThis.fetch;
    beforeEach(() => {
      globalThis.fetch = originalFetch;
    });
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('clamps retries: -1 to 0 and makes one request', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      }) as typeof fetch;
      const body = await doRequest('https://example.com', { retries: -1 });
      expect(body).toBe('ok');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('clamps retries: NaN to 0 and makes one request', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      }) as typeof fetch;
      const body = await doRequest('https://example.com', {
        retries: Number.NaN,
      });
      expect(body).toBe('ok');
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('doRequest timeoutMs validation', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

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
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      }) as typeof fetch;
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
          { appId: 'test' },
          ['id', 'appId'],
          'Either id or appId required'
        );
      }).not.toThrow();
    });

    it('should throw when no required field is present', () => {
      expect(() => {
        validateRequiredField({ foo: 'bar' }, ['id'], 'ID required');
      }).toThrow('ID required');
    });

    it('should throw when none of multiple fields are present', () => {
      expect(() => {
        validateRequiredField(
          { foo: 'bar' },
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
