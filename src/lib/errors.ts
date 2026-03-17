/**
 * Error thrown when an HTTP request fails with a non-OK status.
 * Extends Error so existing `catch (err)` and `err.message` checks keep working.
 * Use `error.status` (and optionally `error.url`) for structured handling instead of parsing the message.
 *
 * @example
 * try {
 *   await doRequest(url);
 * } catch (err) {
 *   if (err instanceof HttpError && err.status === 404) {
 *     // handle not found
 *   }
 *   throw err;
 * }
 */
export class HttpError extends Error {
  /**
   * HTTP status code (e.g. 404, 500). Usually reflects the actual response
   * status, but may represent a logical status when the HTTP request itself
   * succeeded (e.g. 404 for "app not found" when the API returned 200 with
   * zero results).
   */
  readonly status: number;
  /** Request URL (if available). */
  readonly url?: string;

  constructor(message: string, status: number, url?: string) {
    super(message);
    // Ensures instanceof HttpError works after transpilation to ES5 (e.g. Babel, older targets).
    Object.setPrototypeOf(this, HttpError.prototype);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    // Maintains proper stack trace in V8 (Node, Chrome).
    // Stryker disable all: captureStackTrace is a V8 stack-trace optimization, not behavioral
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
    // Stryker restore all
  }
}

/**
 * Error thrown when the ratings endpoint returns 200 OK but the body is empty
 * (no parseable data). Extends {@link HttpError} so existing `catch (err)`
 * handling that checks `instanceof HttpError` keeps working.
 *
 * Use `instanceof RatingsEmptyError` instead of matching on the error message
 * string — this is refactoring-safe and compiler-checked.
 *
 * @example
 * try {
 *   await ratings({ id: 123 });
 * } catch (err) {
 *   if (err instanceof RatingsEmptyError) {
 *     // no ratings data available
 *   }
 * }
 */
export class RatingsEmptyError extends HttpError {
  constructor(url?: string) {
    super('No ratings data returned', 200, url);
    Object.setPrototypeOf(this, RatingsEmptyError.prototype);
    this.name = 'RatingsEmptyError';
    // Stryker disable all: captureStackTrace is a V8 stack-trace optimization, not behavioral
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RatingsEmptyError);
    }
    // Stryker restore all
  }
}

/**
 * Error thrown when caller-provided options fail validation (e.g. missing required
 * fields, invalid country code, out-of-range pagination).
 *
 * Use `instanceof ValidationError` to distinguish "bad input" from network / API
 * errors ({@link HttpError}). The `field` property (when set) identifies which
 * option triggered the error.
 *
 * @example
 * try {
 *   await app({ id: undefined });
 * } catch (err) {
 *   if (err instanceof ValidationError) {
 *     console.error(`Invalid input: ${err.message} (field: ${err.field})`);
 *   }
 * }
 */
export class ValidationError extends Error {
  /** Option field name that failed validation (when identifiable). */
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
    this.name = 'ValidationError';
    this.field = field;
    // Stryker disable all: captureStackTrace is a V8 stack-trace optimization, not behavioral
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
    // Stryker restore all
  }
}
