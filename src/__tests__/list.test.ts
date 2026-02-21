import { describe, it, expect } from 'vitest';
import { list } from '../lib/list.js';
import type { ListApp } from '../types/app.js';
import { collection } from '../types/constants.js';

describe('list', () => {
  it('returns ListApp[] when fullDetail is false (default)', { timeout: 10000 }, async () => {
    const results = await list({
      collection: collection.TOP_FREE_IOS,
      num: 5,
      country: 'us',
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);

    const first = results[0] as ListApp;
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
    expect(typeof first.free).toBe('boolean');
  });

  it('returns App[] when fullDetail is true', { timeout: 15000 }, async () => {
    const results = await list({
      collection: collection.TOP_FREE_IOS,
      num: 3,
      fullDetail: true,
      country: 'us',
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
