import type { App } from '../types/app.js';
import type { DeveloperOptions } from '../types/options.js';
import { DEFAULT_COUNTRY } from '../types/constants.js';
import { lookup } from './common.js';
import { validateCountry } from './validate.js';

/**
 * Retrieves all apps from a specific developer
 * @param options - Options including developer ID
 * @returns Promise resolving to array of apps
 *
 * @example
 * ```typescript
 * const apps = await developer({ devId: 284882218 });
 * ```
 */
export async function developer(options: DeveloperOptions): Promise<App[]> {
  const { devId, country = DEFAULT_COUNTRY, lang, requestOptions } = options;

  validateCountry(country);
  if (devId == null) {
    throw new Error('devId is required');
  }

  return lookup(devId, 'artistId', country, lang, requestOptions);
}
