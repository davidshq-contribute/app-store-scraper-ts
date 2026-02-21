import { describe, it, expect } from 'vitest';
import {
  validateCountry,
  validateCollection,
  validateCategory,
  validateDevice,
  validateSort,
  validateReviewsPage,
  validateListNum,
  validateSearchPagination,
} from '../lib/validate.js';
import { collection, category, device, sort } from '../types/constants.js';

describe('validate', () => {
  it('throws clear error for invalid country, collection, category, or device (allowlist validation)', () => {
    expect(() => validateCountry('xx')).toThrow('Invalid country: "xx"');
    expect(() => validateCollection('invalid')).toThrow('Invalid collection: "invalid"');
    expect(() => validateCategory(99999)).toThrow('Invalid category: 99999');
    expect(() => validateDevice('invalid')).toThrow('Invalid device: "invalid"');
  });

  describe('validateCountry', () => {
    it('accepts valid country codes (case-insensitive)', () => {
      expect(() => validateCountry('us')).not.toThrow();
      expect(() => validateCountry('US')).not.toThrow();
      expect(() => validateCountry('gb')).not.toThrow();
      expect(() => validateCountry('jp')).not.toThrow();
    });

    it('throws clear error for invalid country', () => {
      expect(() => validateCountry('xx')).toThrow('Invalid country: "xx"');
      expect(() => validateCountry('')).toThrow('Invalid country: ""');
    });
  });

  describe('validateCollection', () => {
    it('accepts valid collection values', () => {
      expect(() => validateCollection(collection.TOP_FREE_IOS)).not.toThrow();
      expect(() => validateCollection(collection.TOP_PAID_IPAD)).not.toThrow();
    });

    it('throws clear error for invalid collection', () => {
      expect(() => validateCollection('invalid')).toThrow('Invalid collection: "invalid"');
    });
  });

  describe('validateCategory', () => {
    it('accepts valid category (genre ID) values', () => {
      expect(() => validateCategory(category.GAMES)).not.toThrow();
      expect(() => validateCategory(category.BUSINESS)).not.toThrow();
    });

    it('throws clear error for invalid category', () => {
      expect(() => validateCategory(99999)).toThrow('Invalid category: 99999');
    });
  });

  describe('validateDevice', () => {
    it('accepts valid device values', () => {
      expect(() => validateDevice(device.ALL)).not.toThrow();
      expect(() => validateDevice(device.IPAD)).not.toThrow();
      expect(() => validateDevice(device.MAC)).not.toThrow();
    });

    it('throws clear error for invalid device', () => {
      expect(() => validateDevice('invalid')).toThrow('Invalid device: "invalid"');
    });
  });

  describe('validateSort', () => {
    it('accepts valid sort values', () => {
      expect(() => validateSort(sort.RECENT)).not.toThrow();
      expect(() => validateSort(sort.HELPFUL)).not.toThrow();
    });

    it('throws clear error for invalid sort', () => {
      expect(() => validateSort('invalid')).toThrow('Invalid sort: "invalid"');
    });
  });

  describe('validateReviewsPage', () => {
    it('accepts page in 1–10', () => {
      expect(() => validateReviewsPage(1)).not.toThrow();
      expect(() => validateReviewsPage(5)).not.toThrow();
      expect(() => validateReviewsPage(10)).not.toThrow();
    });

    it('throws for out-of-range or non-integer', () => {
      expect(() => validateReviewsPage(0)).toThrow('page must be an integer between 1 and 10');
      expect(() => validateReviewsPage(11)).toThrow('page must be an integer between 1 and 10');
      expect(() => validateReviewsPage(1.5)).toThrow('page must be an integer between 1 and 10');
    });
  });

  describe('validateListNum', () => {
    it('accepts num in 1–200', () => {
      expect(() => validateListNum(1)).not.toThrow();
      expect(() => validateListNum(50)).not.toThrow();
      expect(() => validateListNum(200)).not.toThrow();
    });

    it('throws for out-of-range or non-integer', () => {
      expect(() => validateListNum(0)).toThrow('num must be an integer between 1 and 200');
      expect(() => validateListNum(-1)).toThrow('num must be an integer between 1 and 200');
      expect(() => validateListNum(201)).toThrow('num must be an integer between 1 and 200');
      expect(() => validateListNum(50.5)).toThrow('num must be an integer between 1 and 200');
    });
  });

  describe('validateSearchPagination', () => {
    it('accepts positive integer num and page', () => {
      expect(() => validateSearchPagination(1, 1)).not.toThrow();
      expect(() => validateSearchPagination(50, 2)).not.toThrow();
      expect(() => validateSearchPagination(200, 10)).not.toThrow();
    });

    it('throws for invalid num', () => {
      expect(() => validateSearchPagination(0, 1)).toThrow('num must be a positive integer');
      expect(() => validateSearchPagination(-1, 1)).toThrow('num must be a positive integer');
      expect(() => validateSearchPagination(50.5, 1)).toThrow('num must be a positive integer');
    });

    it('throws for invalid page', () => {
      expect(() => validateSearchPagination(50, 0)).toThrow('page must be a positive integer');
      expect(() => validateSearchPagination(50, -1)).toThrow('page must be a positive integer');
      expect(() => validateSearchPagination(50, 1.5)).toThrow('page must be a positive integer');
    });
  });
});
