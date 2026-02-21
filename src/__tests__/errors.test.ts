import { describe, it, expect } from 'vitest';
import { HttpError } from '../lib/errors.js';

describe('HttpError', () => {
  it('extends Error and has message, status, and optional url', () => {
    const err = new HttpError('Request to https://example.com failed with status 404', 404, 'https://example.com');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toBe('Request to https://example.com failed with status 404');
    expect(err.status).toBe(404);
    expect(err.url).toBe('https://example.com');
    expect(err.name).toBe('HttpError');
  });

  it('allows url to be omitted', () => {
    const err = new HttpError('Request failed with status 500', 500);
    expect(err.status).toBe(500);
    expect(err.url).toBeUndefined();
  });

  it('enables consumers to match on status without parsing message', () => {
    const err = new HttpError('Request to https://x failed with status 404', 404, 'https://x');
    if (err instanceof HttpError && err.status === 404) {
      expect(err.url).toBe('https://x');
    } else {
      expect.fail('expected HttpError with status 404');
    }
  });
});
