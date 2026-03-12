/**
 * Fixture-based tests for appPageDetails().
 *
 * Verifies that the combined parse matches the individual privacy(), similar(),
 * and versionHistory() parsers on the same HTML input. This guards against
 * divergence if parsing logic is changed in parsers.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';
import * as common from '../lib/common.js';
import { appPageDetails } from '../lib/app-page-details.js';
import {
  parsePrivacyFromHtml,
  parseSimilarIdsFromHtml,
  parseVersionHistoryFromHtml,
} from '../lib/parsers.js';
import { HttpError, ValidationError } from '../lib/errors.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';

vi.mock('../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    doRequest: vi.fn(),
  };
});

/** HTML fixture with privacy, similar apps, and version history sections. */
const COMBINED_HTML = `
<!DOCTYPE html>
<html>
<body>
  <h2>Customers Also Bought</h2>
  <a href="https://apps.apple.com/us/app/foo/id111">App 1</a>
  <a href="https://apps.apple.com/us/app/bar/id222">App 2</a>
  <h3>More from this developer</h3>
  <a href="/us/app/baz/id333">App 3</a>

  <dialog data-testid="dialog">
    <a data-test-id="external-link" href="https://example.com/privacy" aria-label="Privacy Policy">Privacy</a>
    <section class="purpose-section">
      <h3>Analytics</h3>
      <li class="purpose-category">
        <span class="category-title">Contact Info</span>
        <ul class="privacy-data-types">
          <li>Email</li>
          <li>Phone</li>
        </ul>
      </li>
    </section>
    <article>
      <h4>2.1.0</h4>
      <p>Bug fixes and improvements</p>
      <time datetime="2025-01-15">Jan 15, 2025</time>
    </article>
    <article>
      <h4>2.0.0</h4>
      <p>Major update</p>
      <time datetime="2024-12-01">Dec 1, 2024</time>
    </article>
  </dialog>
</body>
</html>
`;

/** HTML with no privacy, similar, or version history (empty parse). */
const EMPTY_HTML = `
<!DOCTYPE html>
<html>
<body>
  <p>No relevant content</p>
</body>
</html>
`;

describe('appPageDetails', () => {
  beforeEach(() => {
    vi.mocked(common.doRequest).mockReset();
  });

  it('throws ValidationError when id is missing', async () => {
    await expect(appPageDetails({ id: undefined as unknown as number })).rejects.toThrow(
      ValidationError
    );
  });

  it('throws ValidationError when id is null', async () => {
    await expect(appPageDetails({ id: null as unknown as number })).rejects.toThrow(
      ValidationError
    );
  });

  it('returns empty result on 404', async () => {
    vi.mocked(common.doRequest).mockRejectedValueOnce(new HttpError('Not Found', 404));

    const result = await appPageDetails({ id: 999 });

    expect(result).toEqual({
      privacy: {},
      similarIds: [],
      versionHistory: [],
    });
  });

  it('throws on non-404 fetch errors', async () => {
    vi.mocked(common.doRequest).mockRejectedValueOnce(new HttpError('Server Error', 500));

    await expect(appPageDetails({ id: 999 })).rejects.toThrow(HttpError);
  });

  describe('fixture-based: combined parse matches individual parsers', () => {
    it('combined result matches parsePrivacyFromHtml, parseSimilarIdsFromHtml, parseVersionHistoryFromHtml on same HTML', async () => {
      const appId = 999;
      vi.mocked(common.doRequest).mockResolvedValueOnce(COMBINED_HTML);

      const result = await appPageDetails({ id: appId, country: DEFAULT_COUNTRY });

      const $ = cheerio.load(COMBINED_HTML);
      const expectedPrivacy = parsePrivacyFromHtml($);
      const expectedSimilarIds = parseSimilarIdsFromHtml($, appId);
      const expectedVersionHistory = parseVersionHistoryFromHtml($);

      expect(result.privacy).toEqual(expectedPrivacy);
      expect(result.similarIds).toEqual(expectedSimilarIds);
      expect(result.versionHistory).toEqual(expectedVersionHistory);
    });

    it('parses privacy policy URL and privacy types from fixture', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(COMBINED_HTML);

      const result = await appPageDetails({ id: 999 });

      expect(result.privacy.privacyPolicyUrl).toBe('https://example.com/privacy');
      expect(result.privacy.privacyTypes).toHaveLength(1);
      expect(result.privacy.privacyTypes![0]).toMatchObject({
        privacyType: 'Contact Info',
        name: 'Contact Info',
        description: 'Used for Analytics',
        dataCategories: ['Email', 'Phone'],
        purposes: ['Analytics'],
      });
    });

    it('parses similar app IDs with link types from fixture', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(COMBINED_HTML);

      const result = await appPageDetails({ id: 999 });

      expect(result.similarIds).toHaveLength(3);
      expect(result.similarIds[0]).toEqual({ id: 111, linkType: 'customers-also-bought' });
      expect(result.similarIds[1]).toEqual({ id: 222, linkType: 'customers-also-bought' });
      expect(result.similarIds[2]).toEqual({ id: 333, linkType: 'more-by-developer' });
    });

    it('excludes current app ID from similarIds', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(COMBINED_HTML);

      const result = await appPageDetails({ id: 111 });

      const ids = result.similarIds.map((e) => e.id);
      expect(ids).not.toContain(111);
    });

    it('parses version history from fixture', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(COMBINED_HTML);

      const result = await appPageDetails({ id: 999 });

      expect(result.versionHistory).toHaveLength(2);
      expect(result.versionHistory[0]).toEqual({
        versionDisplay: '2.1.0',
        releaseDate: '2025-01-15',
        releaseNotes: 'Bug fixes and improvements',
      });
      expect(result.versionHistory[1]).toEqual({
        versionDisplay: '2.0.0',
        releaseDate: '2024-12-01',
        releaseNotes: 'Major update',
      });
    });

    it('returns empty privacy, similarIds, versionHistory for HTML with no relevant content', async () => {
      vi.mocked(common.doRequest).mockResolvedValueOnce(EMPTY_HTML);

      const result = await appPageDetails({ id: 999 });

      expect(result.privacy).toEqual({});
      expect(result.similarIds).toEqual([]);
      expect(result.versionHistory).toEqual([]);
    });
  });
});
