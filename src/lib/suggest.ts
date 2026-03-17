import { XMLParser } from 'fast-xml-parser';
import type { Suggestion } from '../types/suggest.js';
import type { SuggestOptions } from '../types/options.js';
import { doRequest, ensureArray } from './common.js';
import { ValidationError } from './errors.js';
import { suggestResponseSchema } from './schemas.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/**
 * Retrieves search term suggestions (autocomplete).
 * @param options - Options including search term
 * @returns Promise resolving to array of suggestions
 * @throws {ValidationError} if `term` is missing or empty
 * @throws {HttpError} on non-OK HTTP response from the Apple hints endpoint
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
    throw new ValidationError('term is required', 'term');
  }

  const params = new URLSearchParams({ clientApplication: 'Software', term });
  const url = `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?${params.toString()}`;

  const body = await doRequest(url, requestOptions);

  const parsedData = xmlParser.parse(body) as unknown;

  // Validate response with Zod
  const validationResult = suggestResponseSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new ValidationError(
      `Suggest API response validation failed: ${validationResult.error.message}`,
      'response'
    );
  }

  const result = validationResult.data;

  // Navigate the plist structure to extract suggestions.
  // Apple uses plist.dict with keys "title" and "hints"; hints is an array of strings.
  const arrayData = result.plist?.dict?.array;

  if (!arrayData || typeof arrayData === 'string') {
    return [];
  }

  const directStrings = arrayData.string;
  if (directStrings === undefined) {
    return [];
  }

  const terms = ensureArray(directStrings).filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );
  return terms.map((s) => ({ term: s }));
}
