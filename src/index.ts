/**
 * @davidshq/app-store-scraper
 *
 * Modern TypeScript library to scrape application data from the iTunes/Mac App Store.
 * This is a complete TypeScript rewrite of facundoolano/app-store-scraper with full
 * type safety and modern dependencies.
 *
 * @packageDocumentation
 *
 * ## Main exports
 *
 * **API methods:** `app`, `resolveAppId`, `list`, `search`, `developer`, `reviews`,
 * `ratings`, `similar`, `suggest`, `privacy`, `versionHistory`, `appPageDetails`
 *
 * **Errors:** `HttpError` (has `status` and `url`), `ValidationError` (has `field`)
 *
 * **Constants:** `collection`, `category`, `device`, `sort`, `markets`, `DEFAULT_COUNTRY`
 *
 * **Types:** `App`, `ListApp`, `RatingHistogram`, `Ratings`, `SimilarApp`, `SimilarLinkType`,
 * `Review`, `VersionHistory`, `Suggestion`, `PrivacyDetails`, `PrivacyType`, `RequestOptions`,
 * `BaseOptions`, and all `*Options` types, plus `AppPageDetailsOptions`, `AppPageDetailsResult`,
 * `SimilarIdEntry`
 *
 * @example
 * ```ts
 * import { app, search, list, HttpError } from '@davidshq/app-store-scraper';
 * const appData = await app({ id: 553834731 });
 * const results = await search({ term: 'minecraft', num: 10 });
 * ```
 */

// Export all API methods
export { app } from './lib/app.js';
export { resolveAppId } from './lib/common.js';
export { list } from './lib/list.js';
export { search } from './lib/search.js';
export { developer } from './lib/developer.js';
export { reviews } from './lib/reviews.js';
export { ratings } from './lib/ratings.js';
export { similar } from './lib/similar.js';
export { suggest } from './lib/suggest.js';
export { privacy } from './lib/privacy.js';
export { versionHistory } from './lib/version-history.js';
export { appPageDetails } from './lib/app-page-details.js';
export { HttpError, ValidationError } from './lib/errors.js';

// Export types
export type {
  App,
  ListApp,
  RatingHistogram,
  Ratings,
  SimilarApp,
  SimilarLinkType,
  Review,
  VersionHistory,
  Suggestion,
  PrivacyDetails,
  PrivacyType,
  RequestOptions,
  BaseOptions,
  ResolveAppIdOptions,
  AppOptions,
  ListOptions,
  SearchOptions,
  DeveloperOptions,
  ReviewsOptions,
  RatingsOptions,
  SimilarOptions,
  SuggestOptions,
  PrivacyOptions,
  VersionHistoryOptions,
  Collection,
  Category,
  Device,
  Sort,
} from './types/index.js';
export type {
  AppPageDetailsOptions,
  AppPageDetailsResult,
  SimilarIdEntry,
} from './lib/app-page-details.js';

// Export constants
export { collection, category, device, sort, markets, DEFAULT_COUNTRY } from './types/index.js';
