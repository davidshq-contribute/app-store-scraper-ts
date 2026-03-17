/**
 * Input validation helpers for caller-provided options.
 *
 * Each validator checks a single field against an allowlist or range and throws
 * {@link ValidationError} on failure. Called early in every public API function
 * so invalid values never reach URL construction or HTTP requests.
 */
import {
  collection,
  category,
  device,
  ITUNES_API_MAX_LIMIT,
  sort,
  markets,
} from '../types/constants.js';
import { ValidationError } from './errors.js';

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
 * @throws {ValidationError} with field "country" if not in allowlist
 */
export function validateCountry(country: string): void {
  const key = country.toLowerCase();
  if (!validCountries.has(key)) {
    throw new ValidationError(`Invalid country: "${country}"`, 'country');
  }
}

/**
 * Validates that `collection` is a supported collection value.
 * Use before interpolating collection into list RSS URLs.
 *
 * @param value - Collection string (e.g. "topfreeapplications")
 * @throws {ValidationError} with field "collection" if not in allowlist
 */
export function validateCollection(value: string): void {
  if (!validCollections.has(value)) {
    throw new ValidationError(`Invalid collection: "${value}"`, 'collection');
  }
}

/**
 * Validates that `category` is a supported category (genre ID).
 * Use before interpolating category into list URLs.
 *
 * @param value - Category genre ID (e.g. 6014 for GAMES)
 * @throws {ValidationError} with field "category" if not in allowlist
 */
export function validateCategory(value: number): void {
  if (!validCategories.has(value)) {
    throw new ValidationError(`Invalid category: ${value}`, 'category');
  }
}

/**
 * Validates that `device` is a supported device/entity value for search.
 * Use before building search URL (entity parameter).
 *
 * @param value - Device entity string (e.g. "software", "iPadSoftware", "macSoftware")
 * @throws {ValidationError} with field "device" if not in allowlist
 */
export function validateDevice(value: string): void {
  if (!validDevices.has(value)) {
    throw new ValidationError(`Invalid device: "${value}"`, 'device');
  }
}

/**
 * Validates that `sort` is a supported review sort value.
 * Use before interpolating sort into reviews RSS URLs.
 *
 * @param value - Sort string (e.g. "mostRecent")
 * @throws {ValidationError} with field "sort" if not in allowlist
 */
export function validateSort(value: string): void {
  if (!validSorts.has(value)) {
    throw new ValidationError(`Invalid sort: "${value}"`, 'sort');
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
 * @throws {ValidationError} with field "page" if page is not an integer in [1, 10]
 */
export function validateReviewsPage(page: number): void {
  if (!Number.isInteger(page) || page < REVIEWS_PAGE_MIN || page > REVIEWS_PAGE_MAX) {
    throw new ValidationError(
      `page must be an integer between ${REVIEWS_PAGE_MIN} and ${REVIEWS_PAGE_MAX}`,
      'page'
    );
  }
}

/** List RSS feed limit: min 1, max per API (see ITUNES_API_MAX_LIMIT). */
const LIST_NUM_MIN = 1;

/**
 * Validates `num` for list() options (number of results).
 * Use before building list RSS URL to avoid sending invalid limit.
 *
 * @param num - Number of results (default 50, max per ITUNES_API_MAX_LIMIT)
 * @throws {ValidationError} with field "num" if num is not in [1, ITUNES_API_MAX_LIMIT]
 */
export function validateListNum(num: number): void {
  if (!Number.isInteger(num) || num < LIST_NUM_MIN || num > ITUNES_API_MAX_LIMIT) {
    throw new ValidationError(
      `num must be an integer between ${LIST_NUM_MIN} and ${ITUNES_API_MAX_LIMIT}`,
      'num'
    );
  }
}

/**
 * Validates `num` and `page` for search() options.
 * Use before building search request to avoid negative limit or offset.
 *
 * @param num - Results per page (must be >= 1)
 * @param page - Page number (must be >= 1)
 * @throws {ValidationError} with field "num" or "page" if invalid
 */
export function validateSearchPagination(num: number, page: number): void {
  if (!Number.isInteger(num) || num < 1) {
    throw new ValidationError('num must be a positive integer', 'num');
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError('page must be a positive integer', 'page');
  }
}
