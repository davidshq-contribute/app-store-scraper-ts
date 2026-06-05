import * as cheerio from 'cheerio';
import type { PrivacyDetails } from '../types/app-details.js';
import type { PrivacyOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { appPageUrl, ensureNumericAppId, fetchAppPage, validateRequiredField } from './common.js';
import { validateCountry } from './validate.js';
import { parsePrivacyFromHtml } from './parsers.js';

/**
 * Retrieves privacy policy details for an app.
 * If the app page returns 404 (app not found), returns an empty object instead of throwing.
 *
 * @param options - Options including app id or appId
 * @returns Promise resolving to privacy details (empty object if app not found)
 * @throws {ValidationError} if neither `id` nor `appId` is provided, or if `country` is invalid
 * @throws {HttpError} on non-404 HTTP errors from the App Store page, or if `appId` cannot be resolved
 *
 * @example
 * ```typescript
 * const result = await privacy({ id: 553834731 });
 * const result = await privacy({ appId: 'com.example.app' });
 * ```
 */
export async function privacy(options: PrivacyOptions): Promise<PrivacyDetails> {
  validateRequiredField(options, ['id', 'appId'], 'Either id or appId is required');

  const { country = DEFAULT_COUNTRY, requestOptions } = options;
  validateCountry(country);
  const id = await ensureNumericAppId(options);

  const url = appPageUrl(country, id);
  const appPageBody = await fetchAppPage(url, requestOptions);
  if (appPageBody === null) return {};

  const $ = cheerio.load(appPageBody);
  return parsePrivacyFromHtml($);
}
