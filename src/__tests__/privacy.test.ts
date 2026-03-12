/**
 * Unit tests for privacy().
 *
 * Covers validation, 404 handling, non-404 error propagation,
 * and fixture-based HTML parsing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { privacy } from '../lib/privacy.js';
import * as common from '../lib/common.js';
import { HttpError, ValidationError } from '../lib/errors.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
  };
});

/** HTML fixture with privacy data. */
const PRIVACY_HTML = `
<!DOCTYPE html>
<html><body>
  <dialog data-testid="dialog">
    <a data-test-id="external-link" href="https://example.com/privacy" aria-label="Privacy Policy">Privacy</a>
    <section class="purpose-section">
      <h3>Analytics</h3>
      <li class="purpose-category">
        <span class="category-title">Usage Data</span>
        <ul class="privacy-data-types">
          <li>Product Interaction</li>
          <li>Advertising Data</li>
        </ul>
      </li>
    </section>
    <section class="purpose-section">
      <h3>App Functionality</h3>
      <li class="purpose-category">
        <span class="category-title">Contact Info</span>
        <ul class="privacy-data-types">
          <li>Email Address</li>
        </ul>
      </li>
    </section>
  </dialog>
</body></html>
`;

/** HTML with no privacy sections. */
const EMPTY_HTML = `<!DOCTYPE html><html><body><p>No privacy info</p></body></html>`;

describe('privacy', () => {
  beforeEach(() => {
    vi.mocked(common.doRequest).mockReset();
  });

  describe('validation', () => {
    it('throws ValidationError when id is missing', async () => {
      await expect(privacy({ id: undefined as unknown as number })).rejects.toThrow(
        ValidationError
      );
      await expect(privacy({ id: undefined as unknown as number })).rejects.toThrow(
        'id is required'
      );
    });

    it('throws ValidationError when id is null', async () => {
      await expect(privacy({ id: null as unknown as number })).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for invalid country', async () => {
      await expect(privacy({ id: 123, country: 'zz' })).rejects.toThrow(ValidationError);
    });
  });

  describe('HTTP error handling', () => {
    it('returns empty object on 404', async () => {
      vi.mocked(common.doRequest).mockRejectedValueOnce(
        new HttpError('Not Found', 404, 'https://apps.apple.com/us/app/id999')
      );

      const result = await privacy({ id: 999 });
      expect(result).toEqual({});
    });

    it('throws on non-404 HTTP errors', async () => {
      vi.mocked(common.doRequest).mockRejectedValueOnce(
        new HttpError('Server Error', 500, 'https://apps.apple.com/us/app/id999')
      );

      await expect(privacy({ id: 999 })).rejects.toThrow(HttpError);
    });

    it('throws on network errors', async () => {
      vi.mocked(common.doRequest).mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(privacy({ id: 999 })).rejects.toThrow(TypeError);
    });
  });

  describe('fixture-based parsing', () => {
    it('parses privacy policy URL', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(PRIVACY_HTML);

      const result = await privacy({ id: 123, country: DEFAULT_COUNTRY });
      expect(result.privacyPolicyUrl).toBe('https://example.com/privacy');
    });

    it('parses privacy types with categories and data types', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(PRIVACY_HTML);

      const result = await privacy({ id: 123, country: DEFAULT_COUNTRY });
      expect(result.privacyTypes).toHaveLength(2);

      expect(result.privacyTypes![0]).toMatchObject({
        privacyType: 'Usage Data',
        dataCategories: ['Product Interaction', 'Advertising Data'],
        purposes: ['Analytics'],
      });

      expect(result.privacyTypes![1]).toMatchObject({
        privacyType: 'Contact Info',
        dataCategories: ['Email Address'],
        purposes: ['App Functionality'],
      });
    });

    it('returns empty object for HTML with no privacy content', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(EMPTY_HTML);

      const result = await privacy({ id: 123, country: DEFAULT_COUNTRY });
      expect(result).toEqual({});
    });

    it('passes country to appPageUrl', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(EMPTY_HTML);

      await privacy({ id: 123, country: 'gb' });

      const calledUrl = vi.mocked(common.doRequest).mock.calls[0]![0];
      expect(calledUrl).toContain('/gb/app/id123');
    });
  });
});
