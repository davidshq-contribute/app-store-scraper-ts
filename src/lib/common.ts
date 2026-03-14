import type { App } from '../types/app.js';
import {
  BODY_PREVIEW_MAX_LEN,
  DEFAULT_COUNTRY,
  DEFAULT_STORE_FRONT_ID,
  markets,
} from '../types/constants.js';
import { iTunesLookupResponseSchema, type ITunesAppResponse } from './schemas.js';
import type { RequestOptions, ResolveAppIdOptions } from '../types/options.js';
import { HttpError, ValidationError } from './errors.js';
import { validateCountry } from './validate.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 0;

/**
 * Builds the App Store app page URL for a given country and numeric app (track) id.
 * Only numeric IDs produce valid URLs; bundle IDs must be resolved to a track id first.
 * Used by app (screenshots), similar, privacy, and versionHistory.
 * @internal
 */
export function appPageUrl(country: string, appId: number): string {
  return `https://apps.apple.com/${country}/app/id${appId}`;
}

/** Returns true if the failure is transient and worth retrying (GET is idempotent). */
function isRetryable(status?: number, err?: unknown): boolean {
  if (status === 429 || status === 503) return true;
  if (err instanceof TypeError) return true; // network / DNS / CORS etc.
  return false;
}

/**
 * Type guard: true when value is an object with a numeric `status` property (e.g. HttpError-like).
 * Used in doRequest catch block to read status for retry logic without type assertions.
 */
function hasStatus(x: unknown): x is { status: number } {
  return (
    typeof x === 'object' &&
    x !== null &&
    'status' in x &&
    typeof (x as { status?: number }).status === 'number'
  );
}

/**
 * Makes an HTTP GET request with optional timeout and retries.
 * On non-OK response, throws an {@link HttpError} (extends Error) with `status` and optional `url`
 * so consumers can match on `error.status === 404` instead of parsing the message.
 *
 * - Uses `AbortSignal.timeout(timeoutMs)` (default 15s). Pass `requestOptions.timeoutMs` to override.
 *   Must be a positive finite number; invalid values throw a clear error before any request.
 * - On 429, 503, network errors, or timeout (AbortError), retries up to `requestOptions.retries` times
 *   (default 0 — opt-in). Set `retries` to a positive value (e.g. 2) to enable; exponential backoff 1s, 2s, 4s.
 *   Invalid values (negative, NaN, non-integer) are clamped to 0 so at least one attempt is always made.
 *   With retries enabled, total wait on repeated timeouts can be up to `timeoutMs * (1 + retries)` plus backoff.
 * - Each request is independent: other concurrent calls (e.g. other crawls) are not blocked; only the call
 *   that made the request blocks until it completes or times out.
 * - Default headers (User-Agent, Accept, Accept-Language) are merged with `requestOptions.headers`; custom
 *   headers override defaults. To avoid bot detection when the default User-Agent ages, pass
 *   `headers: { 'User-Agent': '...' }` in requestOptions.
 */
export async function doRequest(url: string, options?: RequestOptions): Promise<string> {
  const defaultHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ValidationError(
      `Invalid timeoutMs: must be a positive number, got ${timeoutMs === 0 ? '0' : String(timeoutMs)}`,
      'timeoutMs'
    );
  }
  const rawRetries = options?.retries ?? DEFAULT_RETRIES;
  const maxRetries = Math.max(0, Math.floor(Number(rawRetries)) || 0);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...defaultHeaders,
          ...(options?.headers ?? {}),
        },
        signal,
      });

      if (!response.ok) {
        if (attempt < maxRetries && isRetryable(response.status)) {
          // Consume body so the connection can be reused (fetch spec / connection pooling).
          await response.text().catch(() => '');
          const delayMs = 1000 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw new HttpError(
          `Request to ${url} failed with status ${response.status}`,
          response.status,
          url
        );
      }

      return await response.text();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const status = hasStatus(err) ? err.status : undefined;
      if (attempt < maxRetries && (isRetryable(status, err) || lastError?.name === 'AbortError')) {
        const delayMs = 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error('Request failed');
}

/**
 * Parses a string as JSON and returns the result as unknown.
 * On parse failure, throws a clear error including optional status and a short body preview for debugging.
 *
 * @param body - Raw response body string
 * @param context - Optional context (e.g. response status) for error messages
 * @returns Parsed value as unknown
 * @throws Error with message like "Invalid JSON response (status 200): Unexpected token... Body preview: ..."
 * @internal
 */
export function parseJson(body: string, context?: { status?: number }): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const statusPart = context?.status != null ? ` (status ${context.status})` : '';
    const bodyPreview =
      body.length > BODY_PREVIEW_MAX_LEN ? `${body.slice(0, BODY_PREVIEW_MAX_LEN)}...` : body;
    throw new Error(`Invalid JSON response${statusPart}: ${msg}. Body preview: ${bodyPreview}`);
  }
}

/**
 * Parses a value as an integer, returning the fallback when the result would be NaN.
 * Null and undefined are treated as unparseable and fall through to the fallback.
 * @param value - Value to parse (string, number, or unknown; null/undefined → fallback)
 * @param fallback - Value to return when parsing yields NaN (default 0)
 * @returns Parsed integer or fallback
 * @internal
 */
export function safeParseInt(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  const n = parseInt(
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '',
    10
  );
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Cleans and transforms an iTunes API response to our App format.
 * @internal
 */
export function cleanApp(app: ITunesAppResponse): App {
  return {
    id: app.trackId ?? 0,
    appId: app.bundleId ?? '',
    title: app.trackName ?? '',
    url: app.trackViewUrl ?? '',
    description: app.description ?? '',
    icon: app.artworkUrl512 ?? app.artworkUrl100 ?? '',
    genres: app.genres ?? [],
    genreIds: (app.genreIds ?? []).filter((id) => id !== 0), // Apple genre IDs are 6000+; 0 = invalid/unknown (schema already coerces to number)
    primaryGenre: app.primaryGenreName ?? '',
    primaryGenreId: safeParseInt(app.primaryGenreId),
    contentRating: app.contentAdvisoryRating ?? '',
    languages: app.languageCodesISO2A ?? [],
    size: safeParseInt(app.fileSizeBytes),
    requiredOsVersion: app.minimumOsVersion ?? '',
    released: app.releaseDate ?? '',
    updated: app.currentVersionReleaseDate ?? '',
    releaseNotes: app.releaseNotes ?? '',
    version: app.version ?? '',
    price: app.price ?? 0,
    currency: app.currency ?? 'USD',
    free: (app.price ?? 0) === 0,
    developerId: app.artistId ?? 0,
    developer: app.artistName ?? '',
    developerUrl: app.artistViewUrl ?? '',
    developerWebsite: app.sellerUrl,
    score: app.averageUserRating ?? 0, // 0 = sentinel for unknown
    reviews: app.userRatingCount ?? 0, // 0 is valid (no reviews)
    currentVersionScore: app.averageUserRatingForCurrentVersion ?? 0, // 0 = sentinel for unknown
    currentVersionReviews: app.userRatingCountForCurrentVersion ?? 0, // 0 is valid (no reviews)
    screenshots: app.screenshotUrls ?? [],
    ipadScreenshots: app.ipadScreenshotUrls ?? [],
    appletvScreenshots: app.appletvScreenshotUrls ?? [],
    supportedDevices: app.supportedDevices ?? [],
  };
}

/**
 * ID type for lookup: numeric (id, artistId) or string (bundleId).
 * @internal
 */
export type LookupId = number | number[] | string | string[];

/**
 * Looks up apps by ID, bundle ID, or artist ID from iTunes API.
 * Accepts numeric IDs for `id` / `artistId` and string IDs for `bundleId`.
 * @throws {ValidationError} when the iTunes API response fails schema validation (field: `'response'`)
 */
export async function lookup(
  ids: LookupId,
  idField: 'id' | 'bundleId' | 'artistId',
  country = DEFAULT_COUNTRY,
  lang?: string,
  requestOptions?: RequestOptions
): Promise<App[]> {
  const idsArray = ensureArray(ids);
  const idsString = idsArray.map(String).join(',');

  // Map idField to the correct URL parameter name
  // artistId should use 'id' parameter, not 'artistId'
  const paramName = idField === 'artistId' ? 'id' : idField;

  const params = new URLSearchParams({
    [paramName]: idsString,
    country,
    entity: 'software',
  });

  if (lang) {
    params.set('lang', lang);
  }

  const url = `https://itunes.apple.com/lookup?${params.toString()}`;
  const body = await doRequest(url, requestOptions);

  const parsedData = parseJson(body);
  const validationResult = iTunesLookupResponseSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new ValidationError(
      `iTunes API response validation failed: ${validationResult.error.message}`,
      'response'
    );
  }

  const response = validationResult.data;

  // Filter to only software and clean the results
  // The response may include artist records (wrapperType: "artist") and app records
  // We only want apps, which have kind === 'software' or wrapperType === 'software'
  return response.results
    .filter((app) => app.kind === 'software' || app.wrapperType === 'software')
    .map((app) => cleanApp(app));
}

/**
 * Resolves a bundle ID to a numeric track ID via a single iTunes lookup.
 * Use this when you only need the numeric id (e.g. for similar/reviews) instead of
 * calling {@link app}, which also may fetch screenshots and ratings.
 *
 * @param options - Must include `appId` (bundle ID); optional `country`, `requestOptions`
 * @returns The numeric track ID
 * @throws Error if the app is not found
 */
export async function resolveAppId(options: ResolveAppIdOptions): Promise<number> {
  const { appId, country = DEFAULT_COUNTRY, requestOptions } = options;
  validateCountry(country);
  const apps = await lookup(appId, 'bundleId', country, undefined, requestOptions);
  if (apps.length === 0) {
    throw new Error(`App not found: ${appId}`);
  }
  return apps[0]!.id;
}

/**
 * Gets the Apple Store ID for a given country code.
 * @internal
 */
export function storeId(country: string): number {
  const id = markets[country.toLowerCase()];
  return id || markets.us || DEFAULT_STORE_FRONT_ID;
}

/**
 * Ensures an array from a value that could be undefined, null, a single item, or an array.
 * @internal
 */
export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

/**
 * Validates that at least one of the required fields is present.
 * @throws {ValidationError} with field names joined by "/" (e.g. "id/appId")
 * @internal
 */
export function validateRequiredField(
  options: Record<string, unknown>,
  fields: string[],
  errorMessage: string
): void {
  const hasField = fields.some((field) => options[field] != null);
  if (!hasField) {
    throw new ValidationError(errorMessage, fields.join('/'));
  }
}
