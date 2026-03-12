import * as cheerio from 'cheerio';
import type { PrivacyDetails } from '../types/review.js';
import type { PrivacyOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { appPageUrl, doRequest } from './common.js';
import { validateCountry } from './validate.js';
import { HttpError, ValidationError } from './errors.js';
import { parsePrivacyFromHtml } from './parsers.js';

/**
 * Retrieves privacy policy details for an app.
 * If the app page returns 404 (app not found), returns an empty object instead of throwing.
 *
 * @param options - Options including app id
 * @returns Promise resolving to privacy details (empty object if app not found)
 * @throws {ValidationError} if `id` is missing or `country` is invalid
 * @throws {HttpError} on non-404 HTTP errors from the App Store page
 *
 * @example
 * ```typescript
 * const privacy = await privacy({ id: 553834731 });
 * ```
 */
export async function privacy(options: PrivacyOptions): Promise<PrivacyDetails> {
  const { id, country = DEFAULT_COUNTRY, requestOptions } = options;

  if (id == null) {
    throw new ValidationError('id is required', 'id');
  }
  validateCountry(country);

  const url = appPageUrl(country, id);
  let appPageBody: string;
  try {
    appPageBody = await doRequest(url, requestOptions);
  } catch (error) {
    // 404 = app page not found; return empty details (consistent with similar(), app() screenshots/ratings).
    if (error instanceof HttpError && error.status === 404) {
      return {};
    }
    throw error;
  }

  const $ = cheerio.load(appPageBody);
  return parsePrivacyFromHtml($);
}
