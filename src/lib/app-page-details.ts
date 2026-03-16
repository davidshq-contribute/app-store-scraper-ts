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
import type { PrivacyDetails, VersionHistory } from '../types/app-details.js';
import type { RequestOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import {
  appPageUrl,
  fetchAppPage,
  validateRequiredField,
  resolveAppId,
  wrapResolveAppIdError,
} from './common.js';
import { validateCountry } from './validate.js';
import { ValidationError } from './errors.js';
import {
  parsePrivacyFromHtml,
  parseSimilarIdsFromHtml,
  parseVersionHistoryFromHtml,
  type SimilarIdEntry,
} from './parsers.js';

/** Options for appPageDetails(). */
export interface AppPageDetailsOptions {
  /** Track ID */
  id?: number;
  /** Bundle ID (e.g., com.example.app) */
  appId?: string;
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
 * @param options - id or appId (required), country, requestOptions
 * @returns Combined result; 404 returns empty privacy, similarIds, and versionHistory
 * @throws {ValidationError} if neither `id` nor `appId` is provided, or if `country` is invalid
 * @throws {HttpError} on non-404 fetch errors, or if `appId` cannot be resolved
 *
 * @example
 * ```typescript
 * const { privacy, similarIds, versionHistory } = await appPageDetails({ id: 553834731 });
 * const { privacy, similarIds, versionHistory } = await appPageDetails({ appId: 'com.example.app' });
 * ```
 */
export async function appPageDetails(
  options: AppPageDetailsOptions
): Promise<AppPageDetailsResult> {
  validateRequiredField(options, ['id', 'appId'], 'Either id or appId is required');

  const { appId, country = DEFAULT_COUNTRY, requestOptions } = options;
  validateCountry(country);
  let { id } = options;

  if (appId != null && id == null) {
    try {
      id = await resolveAppId({ appId, country, requestOptions });
    } catch (err) {
      wrapResolveAppIdError(appId, err);
    }
  }

  if (id == null) {
    throw new ValidationError('Either id or appId is required', 'id/appId');
  }

  const url = appPageUrl(country, id);
  const body = await fetchAppPage(url, requestOptions);
  if (body === null) {
    return { privacy: {}, similarIds: [], versionHistory: [] };
  }

  const $ = cheerio.load(body);

  return {
    privacy: parsePrivacyFromHtml($),
    similarIds: parseSimilarIdsFromHtml($, id),
    versionHistory: parseVersionHistoryFromHtml($),
  };
}
