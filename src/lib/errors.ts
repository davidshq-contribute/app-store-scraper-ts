/**
 * Error thrown when an HTTP request fails with a non-OK status, or when a response
 * is successful but has no usable body (e.g. 200 OK with empty body reported as 204).
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
 *   if (err instanceof HttpError && err.status === 204) {
 *     // handle success but no content (e.g. empty ratings response)
 *   }
 *   throw err;
 * }
 */
export class HttpError extends Error {
  /** HTTP status code (e.g. 404, 500). May be 204 for "success but no body" in some APIs. */
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
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
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
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}
