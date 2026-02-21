import { describe, it, expect } from 'vitest';
import {
  storeId,
  ensureArray,
  validateRequiredField,
  parseJson,
} from '../lib/common.js';

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
