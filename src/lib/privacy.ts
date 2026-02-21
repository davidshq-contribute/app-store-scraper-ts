import * as cheerio from 'cheerio';
import type { PrivacyDetails, PrivacyType } from '../types/review.js';
import type { PrivacyOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { appPageUrl, doRequest } from './common.js';
import { validateCountry } from './validate.js';
import { HttpError } from './errors.js';

/**
 * Retrieves privacy policy details for an app.
 * If the app page returns 404 (app not found), returns an empty object instead of throwing.
 *
 * @param options - Options including app id
 * @returns Promise resolving to privacy details (empty object if app not found)
 *
 * @example
 * ```typescript
 * const privacy = await privacy({ id: 553834731 });
 * ```
 */
export async function privacy(options: PrivacyOptions): Promise<PrivacyDetails> {
  const { id, country = DEFAULT_COUNTRY, requestOptions } = options;

  if (id == null) {
    throw new Error('id is required');
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

  // Parse the HTML
  const $ = cheerio.load(appPageBody);

  // Find the privacy policy URL from the dialog
  let privacyPolicyUrl: string | undefined;
  $('dialog[data-testid="dialog"] a[data-test-id="external-link"]').each((_, el) => {
    const ariaLabel = $(el).attr('aria-label');
    if (ariaLabel && ariaLabel.includes('Privacy Policy')) {
      privacyPolicyUrl = $(el).attr('href');
      return false; // break the loop
    }
    return; // continue to next iteration
  });

  // Extract privacy types from the dialog sections
  const privacyTypes: PrivacyType[] = [];

  // Find all purpose sections (Analytics, App Functionality, etc.)
  $('dialog[data-testid="dialog"] section.purpose-section').each((_, section) => {
    const $section = $(section);
    const purpose = $section.find('h3').text().trim();

    // Find all category items within this purpose
    $section.find('li.purpose-category').each((_, category) => {
      const $category = $(category);
      const categoryName = $category.find('.category-title').text().trim();

      // Extract data types
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

  // Build the result
  const result: PrivacyDetails = {};

  if (privacyPolicyUrl) {
    result.privacyPolicyUrl = privacyPolicyUrl;
  }

  if (privacyTypes.length > 0) {
    result.privacyTypes = privacyTypes;
  }

  return result;
}
