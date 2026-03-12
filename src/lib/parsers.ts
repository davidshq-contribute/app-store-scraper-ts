/**
 * Shared HTML parsing functions for App Store app pages.
 *
 * Used by privacy(), similar(), versionHistory(), and appPageDetails() so that
 * selector or structure changes only need to be made in one place.
 */
import * as cheerio from 'cheerio';
import type { PrivacyDetails, PrivacyType, VersionHistory } from '../types/review.js';
import type { SimilarLinkType } from '../types/app.js';

/** Section heading text patterns (case-insensitive) mapped to linkType. */
const SECTION_PATTERNS: Array<{ pattern: RegExp; linkType: SimilarLinkType }> = [
  { pattern: /customers\s+also\s+bought/i, linkType: 'customers-also-bought' },
  {
    pattern: /more\s+from\s+(this\s+)?developer|more\s+by\s+developer/i,
    linkType: 'more-by-developer',
  },
  { pattern: /you\s+might\s+also\s+like/i, linkType: 'you-might-also-like' },
  { pattern: /similar\s+apps|related\s+apps/i, linkType: 'similar-apps' },
];

/**
 * Maps section heading text to a similar-link type. Used for parsing "Customers Also Bought",
 * "More by developer", etc. Exported for fixture-based unit tests.
 */
export function getLinkTypeFromHeadingText(text: string): SimilarLinkType {
  const trimmed = text.trim();
  for (const { pattern, linkType } of SECTION_PATTERNS) {
    if (pattern.test(trimmed)) return linkType;
  }
  return 'other';
}

/** Similar app ID with link type, parsed from the page (no lookup). */
export interface SimilarIdEntry {
  id: number;
  linkType: SimilarLinkType;
}

/**
 * Parse privacy details from app page HTML.
 *
 * Extracts privacy policy URL and privacy types from the dialog markup.
 * Used by privacy() and appPageDetails().
 *
 * @param $ - Loaded cheerio instance
 * @returns Privacy details (empty object if none found)
 */
export function parsePrivacyFromHtml($: cheerio.CheerioAPI): PrivacyDetails {
  const result: PrivacyDetails = {};

  let privacyPolicyUrl: string | undefined;
  $('dialog[data-testid="dialog"] a[data-test-id="external-link"]').each((_, el) => {
    const ariaLabel = $(el).attr('aria-label');
    if (ariaLabel && ariaLabel.includes('Privacy Policy')) {
      privacyPolicyUrl = $(el).attr('href');
      return false;
    }
    return;
  });
  if (privacyPolicyUrl) result.privacyPolicyUrl = privacyPolicyUrl;

  const privacyTypes: PrivacyType[] = [];
  $('dialog[data-testid="dialog"] section.purpose-section').each((_, section) => {
    const $section = $(section);
    const purpose = $section.find('h3').text().trim();
    $section.find('li.purpose-category').each((_, category) => {
      const $category = $(category);
      const categoryName = $category.find('.category-title').text().trim();
      const dataTypes: string[] = [];
      $category.find('.privacy-data-types li').each((_, li) => {
        dataTypes.push($(li).text().trim());
      });
      if (categoryName && dataTypes.length > 0) {
        privacyTypes.push({
          privacyType: categoryName,
          name: categoryName,
          description: `Used for ${purpose}`,
          dataCategories: dataTypes,
          purposes: [purpose],
        });
      }
    });
  });
  if (privacyTypes.length > 0) result.privacyTypes = privacyTypes;

  return result;
}

/**
 * Parse similar app IDs from app page HTML.
 *
 * Walks headings and app links to collect (id, linkType) pairs. Only includes
 * links that appear after the first recognized "similar" section heading.
 * Used by similar() and appPageDetails().
 *
 * @param $ - Loaded cheerio instance
 * @param excludeId - App ID to exclude (the current app)
 * @returns Array of similar app IDs with link types
 */
export function parseSimilarIdsFromHtml(
  $: cheerio.CheerioAPI,
  excludeId: number
): SimilarIdEntry[] {
  const entries: SimilarIdEntry[] = [];
  let currentLinkType: SimilarLinkType = 'other';
  let seenKnownSection = false;

  $('body')
    .find('h2, h3, h4, a[href*="/app/"]')
    .each((_, element) => {
      const $el = $(element);
      const tagName = element.tagName?.toLowerCase();

      if (tagName === 'a') {
        if (!seenKnownSection) return;
        const href = $el.attr('href');
        if (href) {
          const match = href.match(/\/id(\d+)/);
          if (match && match[1]) {
            const appIdNum = parseInt(match[1], 10);
            if (appIdNum !== excludeId) {
              entries.push({ id: appIdNum, linkType: currentLinkType });
            }
          }
        }
        return;
      }

      if (tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
        currentLinkType = getLinkTypeFromHeadingText($el.text());
        if (currentLinkType !== 'other') seenKnownSection = true;
      }
    });

  return entries;
}

/**
 * Parse version history from app page HTML.
 *
 * Extracts version entries from dialog articles that contain a time[datetime]
 * element. Used by versionHistory() and appPageDetails().
 *
 * @param $ - Loaded cheerio instance
 * @returns Array of version history entries
 */
export function parseVersionHistoryFromHtml($: cheerio.CheerioAPI): VersionHistory[] {
  const versions: VersionHistory[] = [];

  $('dialog[data-testid="dialog"] article').each((_, element) => {
    const $article = $(element);
    if ($article.find('time[datetime]').length === 0) return;

    const releaseNotes = $article.find('> p').text().trim();
    const versionDisplay = $article.find('> h4').text().trim();
    const releaseDateRaw = $article.find('time').attr('datetime') ?? '';

    versions.push({
      versionDisplay,
      releaseDate: releaseDateRaw,
      releaseNotes: releaseNotes || undefined,
    });
  });

  return versions;
}
