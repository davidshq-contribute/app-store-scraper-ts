import type { Collection, Category, Sort } from './constants.js';

/**
 * Options passed through to the underlying `fetch()` for HTTP requests.
 *
 * **Supported:**
 * - `headers` – Custom headers merged over the default User-Agent, Accept, and Accept-Language.
 * - `timeoutMs` – Request timeout in milliseconds (default: 30000). Uses `AbortSignal.timeout()`.
 * - `retries` – Number of retries for transient failures (default: 2). Retries on 429, 503, and
 *   network errors, with exponential backoff. Set to 0 to disable. Only applies to idempotent GETs.
 */
export interface RequestOptions {
  /** Custom request headers (merged with defaults). */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
  /** Number of retries for transient failures (429, 503, network). Default 2. Set 0 to disable. */
  retries?: number;
}

/**
 * Common options for requests
 */
export interface BaseOptions {
  /** Two-letter country code (default: {@link DEFAULT_COUNTRY}) */
  country?: string;
  /** Language code (e.g., "en-us") */
  lang?: string;
  /** Custom request options */
  requestOptions?: RequestOptions;
}

/**
 * Options for the app() method
 */
export interface AppOptions extends BaseOptions {
  /** Track ID (numeric) */
  id?: number;
  /** Bundle ID (e.g., com.example.app) */
  appId?: string;
  /** Whether to include rating histogram */
  ratings?: boolean;
}

/**
 * Options for the list() method
 */
export interface ListOptions extends BaseOptions {
  /** Collection type (default: TOP_FREE_IOS) */
  collection?: Collection;
  /** Category/genre filter */
  category?: Category;
  /** Number of results (default: 50, max: 200) */
  num?: number;
  /**
   * If false (default), returns a light shape ({@link ListApp}) from the RSS feed only (one request).
   * If true, fetches full details via lookup and returns {@link App[]}.
   */
  fullDetail?: boolean;
}

/**
 * Options for the search() method.
 *
 * Pagination note: the iTunes Search API returns at most 200 results per query
 * (no offset). So with `num` results per page, only pages 1 through
 * ceil(200 / num) can return data; higher pages may be empty or partial.
 */
export interface SearchOptions extends BaseOptions {
  /** Search term (required) */
  term: string;
  /** Number of results per page (default: 50) */
  num?: number;
  /** Page number (default: 1). Effective range is limited by the API's 200-result cap. */
  page?: number;
  /** Return only app IDs */
  idsOnly?: boolean;
}

/**
 * Options for the developer() method
 */
export interface DeveloperOptions extends BaseOptions {
  /** Developer ID (artistId) - required */
  devId: number;
}

/**
 * Options for the reviews() method
 */
export interface ReviewsOptions extends BaseOptions {
  /** Track ID */
  id?: number;
  /** Bundle ID */
  appId?: string;
  /** Page number (1-10, default: 1) */
  page?: number;
  /** Sort order (default: RECENT) */
  sort?: Sort;
}

/**
 * Options for the ratings() method
 */
export interface RatingsOptions extends Omit<BaseOptions, 'lang'> {
  /** Track ID (required) */
  id: number;
}

/**
 * Options for the similar() method
 */
export interface SimilarOptions extends BaseOptions {
  /** Track ID */
  id?: number;
  /** Bundle ID */
  appId?: string;
  /**
   * If true, return `SimilarApp[]` (each item has `app` and `linkType`).
   * If false or omitted, return `App[]` (backward compatible).
   * @default false
   */
  includeLinkType?: boolean;
}

/**
 * Options for the suggest() method
 */
export interface SuggestOptions extends Omit<BaseOptions, 'lang'> {
  /** Search term (required) */
  term: string;
}

/**
 * Options for the privacy() method
 */
export interface PrivacyOptions extends Omit<BaseOptions, 'lang'> {
  /** Track ID (required) */
  id: number;
}

/**
 * Options for the versionHistory() method
 */
export interface VersionHistoryOptions extends Omit<BaseOptions, 'lang'> {
  /** Track ID (required) */
  id: number;
}

