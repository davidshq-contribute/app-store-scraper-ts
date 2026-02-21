import * as cheerio from 'cheerio';
import type { VersionHistory } from '../types/review.js';
import type { VersionHistoryOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { appPageUrl, doRequest } from './common.js';
import { validateCountry } from './validate.js';
import { HttpError } from './errors.js';

/**
 * Retrieves version history for an app.
 * Only includes entries from dialog articles that contain a `time[datetime]` element,
 * so other dialogs using the same data-testid are excluded.
 * If the app page returns 404 (app not found), returns an empty array instead of throwing.
 *
 * @param options - Options including app id
 * @returns Promise resolving to array of version history entries (empty if app not found)
 *
 * @example
 * ```typescript
 * const history = await versionHistory({ id: 553834731 });
 * ```
 */
export async function versionHistory(options: VersionHistoryOptions): Promise<VersionHistory[]> {
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
    // 404 = app page not found; return empty array (consistent with similar(), app() screenshots/ratings).
    if (error instanceof HttpError && error.status === 404) {
      return [];
    }
    throw error;
  }

  // Parse the HTML
  const $ = cheerio.load(appPageBody);

  // Find version history entries: only articles that contain time[datetime] (avoids other dialogs using data-testid="dialog")
  const versions: VersionHistory[] = [];

  $('dialog[data-testid="dialog"] article').each((_, element) => {
    const $article = $(element);
    if ($article.find('time[datetime]').length === 0) {
      return;
    }

    const releaseNotes = $article.find('> p').text().trim();
    const versionDisplay = $article.find('> h4').text().trim();

    // Extract release date from time element
    const releaseDateRaw = $article.find('time').attr('datetime') ?? '';

    versions.push({
      versionDisplay,
      releaseDate: releaseDateRaw,
      releaseNotes: releaseNotes || undefined,
    });
  });

  return versions;
}
