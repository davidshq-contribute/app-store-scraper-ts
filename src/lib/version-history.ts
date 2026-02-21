import * as cheerio from 'cheerio';
import type { VersionHistory } from '../types/review.js';
import type { VersionHistoryOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { doRequest } from './common.js';

/**
 * Retrieves version history for an app
 * @param options - Options including app id
 * @returns Promise resolving to array of version history entries
 *
 * @example
 * ```typescript
 * const history = await versionHistory({ id: 553834731 });
 * ```
 */
export async function versionHistory(options: VersionHistoryOptions): Promise<VersionHistory[]> {
  const { id, country = DEFAULT_COUNTRY, requestOptions } = options;

  if (!id) {
    throw new Error('id is required');
  }

  // Fetch the app page which contains version history in the HTML
  const appPageUrl = `https://apps.apple.com/${country}/app/id${id}`;
  const appPageBody = await doRequest(appPageUrl, requestOptions);

  // Parse the HTML
  const $ = cheerio.load(appPageBody);

  // Find all version history entries in the dialog (structural selectors to avoid Svelte class hashes)
  const versions: VersionHistory[] = [];

  $('dialog[data-testid="dialog"] article').each((_, element) => {
    const $article = $(element);

    const releaseNotes = $article.find('> p').text().trim();
    const versionDisplay = $article.find('> h4').text().trim();

    // Extract release date from time element
    const releaseDateRaw = $article.find('time').attr('datetime') || '';

    versions.push({
      versionDisplay,
      releaseDate: releaseDateRaw,
      releaseNotes: releaseNotes || undefined,
    });
  });

  return versions;
}
