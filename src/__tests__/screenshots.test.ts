/**
 * Screenshots tests: fixture-based unit tests (run in CI) and live API integration tests.
 */
import { describe, it, expect } from 'vitest';
import { app, extractScreenshotUrl, parseScreenshotsFromHtml } from '../lib/app.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { runIntegrationTests } from './integration.js';

describe('screenshots', () => {
  describe('unit (fixtures)', () => {
    describe('extractScreenshotUrl', () => {
      const base = 'https://is1-ssl.mzstatic.com/image/thumb/foo/100x100bb';

      it('normalizes single srcset entry to 392x696 and preserves webp', () => {
        const srcset = `${base}.webp 1w`;
        expect(extractScreenshotUrl(srcset)).toBe(
          'https://is1-ssl.mzstatic.com/image/thumb/foo/392x696bb.webp'
        );
      });

      it('picks highest width when multiple entries and normalizes', () => {
        const srcset = `${base}.webp 300w, https://is1-ssl.mzstatic.com/image/thumb/bar/200x200bb.webp 600w`;
        expect(extractScreenshotUrl(srcset)).toMatch(/\/392x696bb\.webp$/);
        expect(extractScreenshotUrl(srcset)).toContain('/bar/');
      });

      it('preserves jpg and png extensions', () => {
        expect(extractScreenshotUrl(`${base}.jpg 100w`)).toBe(
          'https://is1-ssl.mzstatic.com/image/thumb/foo/392x696bb.jpg'
        );
        expect(extractScreenshotUrl(`${base}.jpeg 100w`)).toBe(
          'https://is1-ssl.mzstatic.com/image/thumb/foo/392x696bb.jpeg'
        );
        expect(extractScreenshotUrl(`${base}.png 100w`)).toBe(
          'https://is1-ssl.mzstatic.com/image/thumb/foo/392x696bb.png'
        );
      });

      it('preserves query string after normalization', () => {
        const srcset = `${base}.webp?q=80 100w`;
        expect(extractScreenshotUrl(srcset)).toBe(
          'https://is1-ssl.mzstatic.com/image/thumb/foo/392x696bb.webp?q=80'
        );
      });

      it('returns null for empty string', () => {
        expect(extractScreenshotUrl('')).toBeNull();
      });

      it('handles srcset with no width descriptor (uses first URL)', () => {
        const srcset = `${base}.webp`;
        expect(extractScreenshotUrl(srcset)).toBe(
          'https://is1-ssl.mzstatic.com/image/thumb/foo/392x696bb.webp'
        );
      });

      it('normalizes -N suffix in size segment (e.g. 100x100bb-1)', () => {
        const srcset = `https://is1-ssl.mzstatic.com/image/thumb/foo/100x100bb-1.webp 200w`;
        expect(extractScreenshotUrl(srcset)).toBe(
          'https://is1-ssl.mzstatic.com/image/thumb/foo/392x696bb.webp'
        );
      });
    });

    describe('parseScreenshotsFromHtml', () => {
      function fixtureShelf(
        listClass: string,
        srcset: string
      ): string {
        return `<ul class="shelf-grid__list ${listClass}">
          <li><picture><source type="image/webp" srcset="${srcset}"></source></picture></li>
        </ul>`;
      }

      const sampleSrcset = 'https://is1-ssl.mzstatic.com/image/thumb/foo/100x100bb.webp 100w';

      it('returns empty arrays for empty or unrelated HTML', () => {
        const out = parseScreenshotsFromHtml('<html><body></body></html>');
        expect(out.screenshots).toEqual([]);
        expect(out.ipadScreenshots).toEqual([]);
        expect(out.appletvScreenshots).toEqual([]);
      });

      it('extracts iPhone screenshots from shelf-grid__list--grid-type-ScreenshotPhone', () => {
        const html = fixtureShelf('shelf-grid__list--grid-type-ScreenshotPhone', sampleSrcset);
        const out = parseScreenshotsFromHtml(html);
        expect(out.screenshots).toHaveLength(1);
        expect(out.screenshots[0]).toMatch(/392x696bb\.webp$/);
        expect(out.ipadScreenshots).toEqual([]);
        expect(out.appletvScreenshots).toEqual([]);
      });

      it('extracts iPad screenshots from shelf-grid__list--grid-type-ScreenshotPad', () => {
        const html = fixtureShelf('shelf-grid__list--grid-type-ScreenshotPad', sampleSrcset);
        const out = parseScreenshotsFromHtml(html);
        expect(out.ipadScreenshots).toHaveLength(1);
        expect(out.ipadScreenshots[0]).toMatch(/392x696bb\.webp$/);
        expect(out.screenshots).toEqual([]);
        expect(out.appletvScreenshots).toEqual([]);
      });

      it('extracts Apple TV screenshots from shelf-grid__list--grid-type-ScreenshotAppleTv', () => {
        const html = fixtureShelf('shelf-grid__list--grid-type-ScreenshotAppleTv', sampleSrcset);
        const out = parseScreenshotsFromHtml(html);
        expect(out.appletvScreenshots).toHaveLength(1);
        expect(out.appletvScreenshots[0]).toMatch(/392x696bb\.webp$/);
        expect(out.screenshots).toEqual([]);
        expect(out.ipadScreenshots).toEqual([]);
      });

      it('only matches source[type="image/webp"] inside the correct ul', () => {
        const html =
          fixtureShelf('shelf-grid__list--grid-type-ScreenshotPhone', sampleSrcset) +
          '<ul class="shelf-grid__list shelf-grid__list--grid-type-ScreenshotPad">' +
          '<source type="image/jpeg" srcset="https://other.com/bar.jpg 1w"></source></ul>';
        const out = parseScreenshotsFromHtml(html);
        expect(out.screenshots).toHaveLength(1);
        expect(out.ipadScreenshots).toEqual([]);
      });
    });
  });

  describe.skipIf(!runIntegrationTests)('live API', () => {
  // Test with the specified app ID 6756671942 (Bygone - Yesterday's Weather)
  // Note: This app's screenshots are not available via iTunes API but are scraped from the App Store page
  describe('app ID 6756671942 (Bygone - scraped screenshots)', () => {
    it('should fetch app and return screenshot arrays', { timeout: 15000 }, async () => {
      const result = await app({ id: 6756671942 });

      expect(result).toBeDefined();
      expect(result.id).toBe(6756671942);
      expect(result.title).toBe('Bygone - Yesterday\'s Weather');

      // Verify screenshots arrays exist
      expect(result.screenshots).toBeDefined();
      expect(Array.isArray(result.screenshots)).toBe(true);

      expect(result.ipadScreenshots).toBeDefined();
      expect(Array.isArray(result.ipadScreenshots)).toBe(true);

      expect(result.appletvScreenshots).toBeDefined();
      expect(Array.isArray(result.appletvScreenshots)).toBe(true);
    });

    it('should scrape screenshots when iTunes API returns empty arrays', { timeout: 15000 }, async () => {
      const result = await app({ id: 6756671942 });

      // This app has screenshots on the App Store page but not via iTunes API
      // Our fallback scraping should find them
      expect(result.screenshots.length).toBeGreaterThan(0);

      // Verify the screenshot URLs are valid (format preserved: webp, jpg, png)
      result.screenshots.forEach((url) => {
        expect(url).toMatch(/^https:\/\/is\d+-ssl\.mzstatic\.com/);
        expect(url).toMatch(/\.(webp|jpg|jpeg|png)$/i);
      });
    });

    it('should have accessible screenshot URLs from scraping', { timeout: 30000 }, async () => {
      const result = await app({ id: 6756671942 });

      // Test that the scraped screenshot URL is accessible
      const screenshotUrl = result.screenshots[0];
      expect(screenshotUrl).toBeDefined();

      if (screenshotUrl) {
        const response = await fetch(screenshotUrl, { method: 'HEAD' });
        expect(response.ok).toBe(true);
        expect(response.headers.get('content-type')).toMatch(/image\//);
      }
    });
  });

  // Test with an app that HAS screenshots (Minecraft)
  describe('app with screenshots (Minecraft)', () => {
    it('should fetch screenshots for Minecraft app', { timeout: 15000 }, async () => {
      const result = await app({ id: 479516143 });

      expect(result.screenshots).toBeDefined();
      expect(Array.isArray(result.screenshots)).toBe(true);
      expect(result.screenshots.length).toBeGreaterThan(0);

      // Minecraft should have iPhone screenshots
      expect(result.screenshots.length).toBeGreaterThanOrEqual(1);
    });

    it('should have valid screenshot URLs', { timeout: 15000 }, async () => {
      const result = await app({ id: 479516143 });

      // Validate iPhone screenshots
      result.screenshots.forEach((url) => {
        expect(url).toMatch(/^https:\/\//);
        expect(url).toMatch(/mzstatic\.com/);
      });

      // Validate iPad screenshots if present
      if (result.ipadScreenshots.length > 0) {
        result.ipadScreenshots.forEach((url) => {
          expect(url).toMatch(/^https:\/\//);
          expect(url).toMatch(/mzstatic\.com/);
        });
      }
    });

    it('should have screenshots that are accessible', { timeout: 30000 }, async () => {
      const result = await app({ id: 479516143 });

      // Test at least one screenshot URL is accessible
      const screenshotUrl = result.screenshots[0];

      expect(screenshotUrl).toBeDefined();

      if (screenshotUrl) {
        const response = await fetch(screenshotUrl, { method: 'HEAD' });
        expect(response.ok).toBe(true);
        expect(response.headers.get('content-type')).toMatch(/image\//);
      }
    });

    it('should return screenshot arrays are always defined', { timeout: 15000 }, async () => {
      const result = await app({ id: 479516143 });

      // Even if empty, the arrays should be defined
      expect(result.screenshots).toBeDefined();
      expect(result.ipadScreenshots).toBeDefined();
      expect(result.appletvScreenshots).toBeDefined();
    });
  });

  describe('screenshot URL structure', () => {
    it('should return screenshot URLs with proper Apple CDN format', { timeout: 15000 }, async () => {
      const result = await app({ id: 479516143 });

      const allScreenshots = [
        ...result.screenshots,
        ...result.ipadScreenshots,
        ...result.appletvScreenshots
      ];

      expect(allScreenshots.length).toBeGreaterThan(0);

      // Apple uses various URL formats, but they should all be from mzstatic.com
      allScreenshots.forEach(url => {
        expect(url).toMatch(/^https:\/\/is\d+-ssl\.mzstatic\.com/);
      });
    });
  });

  describe('screenshots for different countries', () => {
    it('should fetch screenshots regardless of country', { timeout: 15000 }, async () => {
      const usResult = await app({ id: 479516143, country: DEFAULT_COUNTRY });

      // Screenshots should work regardless of country
      expect(usResult.screenshots).toBeDefined();
      expect(Array.isArray(usResult.screenshots)).toBe(true);
      expect(usResult.screenshots.length).toBeGreaterThan(0);
    });
  });
  });
});
