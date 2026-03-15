/**
 * Unit tests for versionHistory().
 *
 * Covers validation, 404 handling, non-404 error propagation,
 * and fixture-based HTML parsing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { versionHistory } from '../lib/version-history.js';
import * as common from '../lib/common.js';
import { HttpError, ValidationError } from '../lib/errors.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
    resolveAppId: vi.fn(),
  };
});

/** HTML fixture with version history entries. */
const VERSION_HISTORY_HTML = `
<!DOCTYPE html>
<html><body>
  <dialog data-testid="dialog">
    <article>
      <h4>3.2.1</h4>
      <p>Fixed crash on startup</p>
      <time datetime="2025-06-15">Jun 15, 2025</time>
    </article>
    <article>
      <h4>3.2.0</h4>
      <p>New dark mode support</p>
      <time datetime="2025-05-01">May 1, 2025</time>
    </article>
    <article>
      <h4>3.1.0</h4>
      <p></p>
      <time datetime="2025-03-10">Mar 10, 2025</time>
    </article>
  </dialog>
</body></html>
`;

/** HTML with a dialog article that has no time element (should be excluded). */
const NO_TIME_HTML = `
<!DOCTYPE html>
<html><body>
  <dialog data-testid="dialog">
    <article>
      <h4>About this app</h4>
      <p>Some description that is not version history</p>
    </article>
  </dialog>
</body></html>
`;

/** HTML with no dialog at all. */
const EMPTY_HTML = `<!DOCTYPE html><html><body><p>Nothing here</p></body></html>`;

describe('versionHistory', () => {
  beforeEach(() => {
    vi.mocked(common.doRequest).mockReset();
    vi.mocked(common.resolveAppId).mockReset();
  });

  describe('validation', () => {
    it('throws ValidationError when neither id nor appId is provided', async () => {
      await expect(versionHistory({} as never)).rejects.toThrow(ValidationError);
      await expect(versionHistory({} as never)).rejects.toThrow('Either id or appId is required');
    });

    it('throws ValidationError for invalid country', async () => {
      await expect(versionHistory({ id: 123, country: 'zz' })).rejects.toThrow(ValidationError);
    });
  });

  describe('appId resolution', () => {
    it('resolves appId to numeric id before fetching', async () => {
      vi.mocked(common.resolveAppId).mockResolvedValueOnce(553834731);
      vi.mocked(common.doRequest).mockResolvedValueOnce('<html></html>');

      await versionHistory({ appId: 'com.example.app' });

      expect(common.resolveAppId).toHaveBeenCalledWith({
        appId: 'com.example.app',
        country: DEFAULT_COUNTRY,
        requestOptions: undefined,
      });
      expect(common.doRequest).toHaveBeenCalledWith(
        expect.stringContaining('id553834731'),
        undefined
      );
    });

    it('prefers id over appId when both are provided', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce('<html></html>');

      await versionHistory({ id: 123, appId: 'com.example.app' });

      expect(common.resolveAppId).not.toHaveBeenCalled();
    });
  });

  describe('HTTP error handling', () => {
    it('returns empty array on 404', async () => {
      vi.mocked(common.doRequest).mockRejectedValueOnce(
        new HttpError('Not Found', 404, 'https://apps.apple.com/us/app/id999')
      );

      const result = await versionHistory({ id: 999 });
      expect(result).toEqual([]);
    });

    it('throws on non-404 HTTP errors', async () => {
      vi.mocked(common.doRequest).mockRejectedValueOnce(
        new HttpError('Server Error', 500, 'https://apps.apple.com/us/app/id999')
      );

      await expect(versionHistory({ id: 999 })).rejects.toThrow(HttpError);
    });

    it('throws on network errors', async () => {
      vi.mocked(common.doRequest).mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(versionHistory({ id: 999 })).rejects.toThrow(TypeError);
    });
  });

  describe('fixture-based parsing', () => {
    it('parses version entries with dates and release notes', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(VERSION_HISTORY_HTML);

      const result = await versionHistory({ id: 123, country: DEFAULT_COUNTRY });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        versionDisplay: '3.2.1',
        releaseDate: '2025-06-15',
        releaseNotes: 'Fixed crash on startup',
      });
      expect(result[1]).toEqual({
        versionDisplay: '3.2.0',
        releaseDate: '2025-05-01',
        releaseNotes: 'New dark mode support',
      });
    });

    it('returns undefined releaseNotes when notes are empty', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(VERSION_HISTORY_HTML);

      const result = await versionHistory({ id: 123, country: DEFAULT_COUNTRY });

      expect(result[2]).toEqual({
        versionDisplay: '3.1.0',
        releaseDate: '2025-03-10',
        releaseNotes: undefined,
      });
    });

    it('excludes articles without time[datetime] element', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(NO_TIME_HTML);

      const result = await versionHistory({ id: 123, country: DEFAULT_COUNTRY });
      expect(result).toEqual([]);
    });

    it('returns empty array for HTML with no dialog', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(EMPTY_HTML);

      const result = await versionHistory({ id: 123, country: DEFAULT_COUNTRY });
      expect(result).toEqual([]);
    });

    it('passes country to appPageUrl', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(EMPTY_HTML);

      await versionHistory({ id: 456, country: 'jp' });

      const calledUrl = vi.mocked(common.doRequest).mock.calls[0]![0];
      expect(calledUrl).toContain('/jp/app/id456');
    });
  });
});
