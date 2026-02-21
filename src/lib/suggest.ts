import { XMLParser } from 'fast-xml-parser';
import type { Suggestion } from '../types/review.js';
import type { SuggestOptions } from '../types/options.js';
import { doRequest, ensureArray } from './common.js';
import { suggestResponseSchema } from './schemas.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/**
 * Retrieves search term suggestions (autocomplete)
 * @param options - Options including search term
 * @returns Promise resolving to array of suggestions
 *
 * @example
 * ```typescript
 * const suggestions = await suggest({ term: 'min' });
 *  Returns: [{ term: 'minecraft' }, { term: 'minecraft pocket edition' }, ...]
 * ```
 */
export async function suggest(options: SuggestOptions): Promise<Suggestion[]> {
  const { term, requestOptions } = options;

  if (term == null || term === '') {
    throw new Error('term is required');
  }

  const url = `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?clientApplication=Software&term=${encodeURIComponent(term)}`;

  const body = await doRequest(url, requestOptions);

  const parsedData = xmlParser.parse(body) as unknown;

  // Validate response with Zod
  const validationResult = suggestResponseSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `Suggest API response validation failed: ${validationResult.error.message}`
    );
  }

  const result = validationResult.data;

  // Navigate the plist structure to extract suggestions
  const arrayData = result.plist?.dict?.array;

  // If array is a string or doesn't have dict, return empty
  if (!arrayData || typeof arrayData === 'string' || !arrayData.dict) {
    return [];
  }

  // API may return a single dict or an array of dicts; normalize to array
  const dicts = ensureArray(arrayData.dict);

  const suggestions: Suggestion[] = [];

  for (const dict of dicts) {
    const strings = ensureArray(dict.string);
    const suggestionTerm = strings[0];
    if (suggestionTerm) {
      suggestions.push({ term: suggestionTerm });
    }
  }

  return suggestions;
}
