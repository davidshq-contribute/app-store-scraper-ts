/**
 * Lightweight app shape returned by `list()` when `fullDetail: false`.
 * Built only from the RSS feed (no lookup), so fewer fields and fewer requests.
 */
export interface ListApp {
  /** Track ID (numeric identifier) */
  id: number;
  /** Bundle identifier (e.g., com.example.app) */
  appId: string;
  /** App name/title */
  title: string;
  /** App icon URL */
  icon: string;
  /** iTunes store URL */
  url: string;
  /** Price in local currency */
  price: number;
  /** Currency code (e.g., "USD", "EUR") */
  currency: string;
  /** Whether the app is free */
  free: boolean;
  /** Short description from the feed */
  description: string;
  /** Developer name */
  developer: string;
  /** Developer iTunes URL */
  developerUrl: string;
  /** Developer ID from feed (string; empty when unknown). Prefer {@link developerIdNum} for type alignment with {@link App}. */
  developerId: string;
  /** Developer ID as number (0 when unknown). Use when handling {@link ListApp} and {@link App} uniformly. */
  developerIdNum: number;
  /** Primary genre name */
  genre: string;
  /** Primary genre ID */
  genreId: string;
  /** Initial release date */
  released: string;
}

/**
 * Represents a complete app from the iTunes/Mac App Store
 */
export interface App {
  /** Track ID (numeric identifier) */
  id: number;
  /** Bundle identifier (e.g., com.example.app) */
  appId: string;
  /** App name/title */
  title: string;
  /** iTunes store URL */
  url: string;
  /** Full app description */
  description: string;
  /** App icon URL (usually 512x512 or 1024x1024) */
  icon: string;
  /** Array of genre names */
  genres: string[];
  /** Array of genre IDs */
  genreIds: string[];
  /** Primary genre name */
  primaryGenre: string;
  /** Primary genre ID */
  primaryGenreId: string;
  /** Content rating (e.g., "4+", "12+", "17+") */
  contentRating: string;
  /** Supported languages (array of language codes) */
  languages: string[];
  /** File size in bytes */
  size: string;
  /** Required iOS/macOS version */
  requiredOsVersion: string;
  /** Initial release date */
  released: string;
  /** Last update date */
  updated: string;
  /** Latest version release notes */
  releaseNotes: string;
  /** Current version number */
  version: string;
  /** Price in local currency */
  price: number;
  /** Currency code (e.g., "USD", "EUR") */
  currency: string;
  /** Whether the app is free */
  free: boolean;
  /** Developer ID (numeric) */
  developerId: number;
  /** Developer name */
  developer: string;
  /** Developer iTunes URL */
  developerUrl: string;
  /** Developer website URL (if available) */
  developerWebsite?: string;
  /**
   * Average user rating (all versions).
   * Use 0 as sentinel for unknown/unavailable; otherwise 1–5.
   */
  score: number;
  /** Total number of ratings (all versions) */
  reviews: number;
  /**
   * Average user rating (current version).
   * Use 0 as sentinel for unknown/unavailable; otherwise 1–5.
   */
  currentVersionScore: number;
  /** Total number of ratings (current version) */
  currentVersionReviews: number;
  /** iPhone/iPod screenshot URLs */
  screenshots: string[];
  /** iPad screenshot URLs */
  ipadScreenshots: string[];
  /** Apple TV screenshot URLs */
  appletvScreenshots: string[];
  /** List of supported device names */
  supportedDevices: string[];
  /** Rating histogram (only if ratings option is true) */
  histogram?: RatingHistogram;
}

/**
 * Rating distribution histogram
 */
export interface RatingHistogram {
  /** Number of 1-star ratings */
  1: number;
  /** Number of 2-star ratings */
  2: number;
  /** Number of 3-star ratings */
  3: number;
  /** Number of 4-star ratings */
  4: number;
  /** Number of 5-star ratings */
  5: number;
}

/**
 * Ratings response with total count and histogram
 */
export interface Ratings {
  /** Total number of ratings */
  ratings: number;
  /** Rating distribution by star count */
  histogram: RatingHistogram;
}

/**
 * Section label for similar/related app links on an App Store app page.
 * Typical values: "customers-also-bought", "more-by-developer", "you-might-also-like", "other".
 */
export type SimilarLinkType =
  | 'customers-also-bought'
  | 'more-by-developer'
  | 'you-might-also-like'
  | 'similar-apps'
  | 'other';

/**
 * One similar/related app with the section it was found in.
 * Returned by `similar()` when `includeLinkType: true`.
 */
export interface SimilarApp {
  /** Full app details */
  app: App;
  /** Section where the link appeared (e.g. "Customers Also Bought", "More by developer") */
  linkType: SimilarLinkType;
}
