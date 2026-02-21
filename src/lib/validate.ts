import {
  collection,
  category,
  device,
  sort,
  markets,
} from '../types/constants.js';

const validCountries = new Set(Object.keys(markets));
const validCollections = new Set<string>(Object.values(collection));
const validCategories = new Set<number>(Object.values(category));
const validDevices = new Set<string>(Object.values(device));
const validSorts = new Set<string>(Object.values(sort));

/**
 * Validates that `country` is in the supported markets allowlist.
 * Use before interpolating country into any URL.
 *
 * @param country - Two-letter country code (e.g. "us")
 * @throws Error with message `Invalid country: "xx"` if not in allowlist
 */
export function validateCountry(country: string): void {
  const key = country.toLowerCase();
  if (!validCountries.has(key)) {
    throw new Error(`Invalid country: "${country}"`);
  }
}

/**
 * Validates that `collection` is a supported collection value.
 * Use before interpolating collection into list RSS URLs.
 *
 * @param value - Collection string (e.g. "topfreeapplications")
 * @throws Error with message `Invalid collection: "..."` if not in allowlist
 */
export function validateCollection(value: string): void {
  if (!validCollections.has(value)) {
    throw new Error(`Invalid collection: "${value}"`);
  }
}

/**
 * Validates that `category` is a supported category (genre ID).
 * Use before interpolating category into list URLs.
 *
 * @param value - Category genre ID (e.g. 6014 for GAMES)
 * @throws Error with message `Invalid category: 123` if not in allowlist
 */
export function validateCategory(value: number): void {
  if (!validCategories.has(value)) {
    throw new Error(`Invalid category: ${value}`);
  }
}

/**
 * Validates that `device` is a supported device/entity value for search.
 * Use before building search URL (entity parameter).
 *
 * @param value - Device entity string (e.g. "software", "iPadSoftware", "macSoftware")
 * @throws Error with message `Invalid device: "..."` if not in allowlist
 */
export function validateDevice(value: string): void {
  if (!validDevices.has(value)) {
    throw new Error(`Invalid device: "${value}"`);
  }
}

/**
 * Validates that `sort` is a supported review sort value.
 * Use before interpolating sort into reviews RSS URLs.
 *
 * @param value - Sort string (e.g. "mostRecent")
 * @throws Error with message `Invalid sort: "..."` if not in allowlist
 */
export function validateSort(value: string): void {
  if (!validSorts.has(value)) {
    throw new Error(`Invalid sort: "${value}"`);
  }
}

/** Reviews RSS feed page: min 1, max 10 (per API). */
const REVIEWS_PAGE_MIN = 1;
const REVIEWS_PAGE_MAX = 10;

/**
 * Validates `page` for reviews() options.
 * Use before building reviews RSS URL.
 *
 * @param page - Page number (1–10)
 * @throws Error if page is not an integer in [1, 10]
 */
export function validateReviewsPage(page: number): void {
  if (!Number.isInteger(page) || page < REVIEWS_PAGE_MIN || page > REVIEWS_PAGE_MAX) {
    throw new Error(`page must be an integer between ${REVIEWS_PAGE_MIN} and ${REVIEWS_PAGE_MAX}`);
  }
}

/** List RSS feed limit: min 1, max 200 (per API). */
const LIST_NUM_MIN = 1;
const LIST_NUM_MAX = 200;

/**
 * Validates `num` for list() options (number of results).
 * Use before building list RSS URL to avoid sending invalid limit.
 *
 * @param num - Number of results (default 50, max 200)
 * @throws Error if num is not in [1, 200]
 */
export function validateListNum(num: number): void {
  if (!Number.isInteger(num) || num < LIST_NUM_MIN || num > LIST_NUM_MAX) {
    throw new Error(`num must be an integer between ${LIST_NUM_MIN} and ${LIST_NUM_MAX}`);
  }
}

/**
 * Validates `num` and `page` for search() options.
 * Use before building search request to avoid negative limit or offset.
 *
 * @param num - Results per page (must be >= 1)
 * @param page - Page number (must be >= 1)
 * @throws Error if num or page is invalid
 */
export function validateSearchPagination(num: number, page: number): void {
  if (!Number.isInteger(num) || num < 1) {
    throw new Error('num must be a positive integer');
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new Error('page must be a positive integer');
  }
}
