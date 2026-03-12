/**
 * Combined app page fetcher.
 *
 * Fetches the App Store app page (apps.apple.com/{country}/app/id{id}) once and
 * parses privacy, similar app IDs, and version history from the same HTML.
 * This avoids multiple requests when consumers need more than one of these.
 *
 * @see docs/DEV-DECISIONS.md (App page consolidation)
 */
import * as cheerio from 'cheerio';
import type { PrivacyDetails, VersionHistory } from '../types/review.js';
import type { RequestOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { appPageUrl, doRequest } from './common.js';
import { validateCountry } from './validate.js';
import { HttpError, ValidationError } from './errors.js';
import {
  parsePrivacyFromHtml,
  parseSimilarIdsFromHtml,
  parseVersionHistoryFromHtml,
  type SimilarIdEntry,
} from './parsers.js';

/** Options for appPageDetails(). */
export interface AppPageDetailsOptions {
  /** Track ID (required) */
  id: number;
  /** Two-letter country code (default: us) */
  country?: string;
  /** Custom request options */
  requestOptions?: RequestOptions;
}

export type { SimilarIdEntry } from './parsers.js';

/** Combined result from a single app page fetch. */
export interface AppPageDetailsResult {
  /** Privacy labels and policy URL (empty object if none) */
  privacy: PrivacyDetails;
  /** Similar app IDs with section labels (empty if none) */
  similarIds: SimilarIdEntry[];
  /** Version history entries (empty if none) */
  versionHistory: VersionHistory[];
}

/**
 * Fetches the App Store app page once and parses privacy, similar app IDs, and version history.
 *
 * Use this when you need more than one of these to avoid multiple requests to the same page.
 * If you only need privacy, `privacy()` is simpler; if you need full similar apps with lookup,
 * use `similar()`.
 *
 * @param options - id (required), country, requestOptions
 * @returns Combined result; 404 returns empty privacy, similarIds, and versionHistory
 * @throws On non-404 fetch errors
 *
 * @example
 * ```typescript
 * const { privacy, similarIds, versionHistory } = await appPageDetails({ id: 553834731 });
 * // Store privacy, use similarIds for discovery, etc.
 * ```
 */
export async function appPageDetails(
  options: AppPageDetailsOptions
): Promise<AppPageDetailsResult> {
  const { id, country = DEFAULT_COUNTRY, requestOptions } = options;

  if (id == null) {
    throw new ValidationError('id is required', 'id');
  }
  validateCountry(country);

  const url = appPageUrl(country, id);
  let body: string;
  try {
    body = await doRequest(url, requestOptions);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return {
        privacy: {},
        similarIds: [],
        versionHistory: [],
      };
    }
    throw error;
  }

  const $ = cheerio.load(body);

  return {
    privacy: parsePrivacyFromHtml($),
    similarIds: parseSimilarIdsFromHtml($, id),
    versionHistory: parseVersionHistoryFromHtml($),
  };
}
