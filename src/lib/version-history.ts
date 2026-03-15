import * as cheerio from 'cheerio';
import type { VersionHistory } from '../types/app-details.js';
import type { VersionHistoryOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { appPageUrl, doRequest, validateRequiredField, resolveAppId } from './common.js';
import { validateCountry } from './validate.js';
import { HttpError, ValidationError } from './errors.js';
import { parseVersionHistoryFromHtml } from './parsers.js';

/**
 * Retrieves version history for an app.
 * Only includes entries from dialog articles that contain a `time[datetime]` element,
 * so other dialogs using the same data-testid are excluded.
 * If the app page returns 404 (app not found), returns an empty array instead of throwing.
 *
 * @param options - Options including app id or appId
 * @returns Promise resolving to array of version history entries (empty if app not found)
 * @throws {ValidationError} if neither `id` nor `appId` is provided, or if `country` is invalid
 * @throws {HttpError} on non-404 HTTP errors from the App Store page, or if `appId` cannot be resolved
 *
 * @example
 * ```typescript
 * const history = await versionHistory({ id: 553834731 });
 * const history = await versionHistory({ appId: 'com.example.app' });
 * ```
 */
export async function versionHistory(options: VersionHistoryOptions): Promise<VersionHistory[]> {
  validateRequiredField(options, ['id', 'appId'], 'Either id or appId is required');

  const { appId, country = DEFAULT_COUNTRY, requestOptions } = options;
  validateCountry(country);
  let { id } = options;

  if (appId != null && id == null) {
    try {
      id = await resolveAppId({ appId, country, requestOptions });
    } catch (err) {
      const message = `Could not resolve app id "${appId}": ${err instanceof Error ? err.message : String(err)}`;
      if (err instanceof HttpError) {
        throw new HttpError(message, err.status, err.url);
      }
      throw new Error(message, { cause: err });
    }
  }

  if (id == null) {
    throw new ValidationError('Either id or appId is required', 'id/appId');
  }

  const url = appPageUrl(country, id);
  let appPageBody: string;
  try {
    appPageBody = await doRequest(url, requestOptions);
  } catch (error) {
    // 404 = app page not found; return empty array (consistent with similar(), app() screenshots/ratings).
    if (error instanceof HttpError && error.status === 404) {
      return [];
    }
    throw error;
  }

  const $ = cheerio.load(appPageBody);
  return parseVersionHistoryFromHtml($);
}
