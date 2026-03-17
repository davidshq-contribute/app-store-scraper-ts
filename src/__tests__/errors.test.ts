import { describe, it, expect } from 'vitest';
import { HttpError, ValidationError } from '../lib/errors.js';

describe('HttpError', () => {
  it('extends Error and has message, status, and optional url', () => {
    const err = new HttpError(
      'Request to https://example.com failed with status 404',
      404,
      'https://example.com'
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toBe('Request to https://example.com failed with status 404');
    expect(err.status).toBe(404);
    expect(err.url).toBe('https://example.com');
    expect('field' in err).toBe(false); // HttpError has no field property
    expect(err.name).toBe('HttpError');
  });

  it('allows url to be omitted', () => {
    const err = new HttpError('Request failed with status 500', 500);
    expect(err.status).toBe(500);
    expect(err.url).toBeUndefined();
    expect('field' in err).toBe(false); // HttpError has no field property
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

describe('ValidationError', () => {
  it('extends Error and has message, field, and name', () => {
    const err = new ValidationError('Invalid country: "zz"', 'country');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err).not.toBeInstanceOf(HttpError); // distinct from HttpError hierarchy
    expect(err.message).toBe('Invalid country: "zz"');
    expect(err.field).toBe('country');
    expect(err.name).toBe('ValidationError');
  });

  it('allows field to be omitted', () => {
    const err = new ValidationError('Something is wrong');
    expect(err.field).toBeUndefined();
    expect(err.message).toBe('Something is wrong');
  });

  it('is not an instance of HttpError (distinct hierarchies)', () => {
    const err = new ValidationError('bad input', 'id');
    expect(err).not.toBeInstanceOf(HttpError);
  });

  it('enables consumers to distinguish validation from HTTP errors', () => {
    const errors: Error[] = [
      new ValidationError('id is required', 'id'),
      new HttpError('Not Found', 404),
    ];

    const validationErrors = errors.filter((e) => e instanceof ValidationError);
    const httpErrors = errors.filter((e) => e instanceof HttpError);

    expect(validationErrors).toHaveLength(1);
    expect(httpErrors).toHaveLength(1);
  });
});
