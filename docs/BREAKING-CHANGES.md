# Breaking changes (v3.0.0)

This document summarizes breaking changes for consumers upgrading from v2.x to v3.0.0. For the full list of v3 changes (including non-breaking), see [CHANGELOG.md](../CHANGELOG.md).

**Summary of major breaking changes**

| # | Area | Summary |
|---|------|---------|
| 1 | `list()` | Returns `ListApp[]` by default; use `fullDetail: true` for `App[]`. |
| 2 | Errors | HTTP failures throw `HttpError`; do not rely on `error.message` text. |
| 3 | Requests | 15s timeout by default; retries default to 0 (opt-in). |
| 4 | Scores | Rating/review scores use 0 as sentinel; valid range 0–5 (no clamp to 1). |
| 5 | Behavior | `similar()`, `app()` ratings, and `app()` screenshots rethrow non-404; screenshot URLs keep original format; no `console.warn` for search; **search() pagination fixed** (page &gt; 1 now returns results). |
| 6 | `ListApp` | `developerId` is number only; `developerIdNum` removed. |
| 7 | `App.size` | Now number (bytes), was string. |
| 8 | Genre IDs | `genreIds`, `primaryGenreId`, `ListApp.genreId` are numeric (were string). |
| 9 | `contentRating` | Unknown is `''`, no longer defaulted to `'4+'`. |
| 10 | Input validation | Invalid `country`, `collection`, `category`, `sort`, `num`, or `page` throw synchronous `Error` before any HTTP request. |

**Silent breakage (JavaScript):** Items 1, 6, 7, 8 and 9 can **fail silently at runtime** for JavaScript consumers (TypeScript catches them at compile time). In particular, the **string → number** changes (#7, #8) produce **wrong results** instead of errors: e.g. `genreIds.includes('6014')` or `app.primaryGenreId === '6014'` silently return `false`. If you use this library from JavaScript, grep for `genreIds`, `primaryGenreId`, `genreId`, `size`, `contentRating`, and `developerIdNum` and update comparisons/defaults as in the sections below.

---

## 1. `list()` return type and default behavior

**v2.x:** `list()` returned `App[]` (full detail) with no option for a lighter shape.

**v3.0:** `list()` returns **`ListApp[]` by default** (light shape from the RSS feed only — one request). To get full app details, pass `fullDetail: true` to receive `App[]`.

**Important:** In v2.x (and on `main` before this fix), `fullDetail` was a no-op — both `fullDetail: true` and `fullDetail: false` returned full `App[]`. If your code called `list()` and relied on always getting the full app shape (screenshots, version, score, genres, etc.), you **must** add `fullDetail: true` in v3 to preserve that behavior.

```typescript
// v2.x
const apps: App[] = await list({ collection: collection.TOP_FREE_IOS });

// v3.x — same behavior (full detail)
const apps: App[] = await list({ collection: collection.TOP_FREE_IOS, fullDetail: true });

// v3.x — new default (light shape, one request)
const apps: ListApp[] = await list({ collection: collection.TOP_FREE_IOS });
```

**Migration:** If you depended on always getting full `App[]` from `list()` (the old behavior), **opt into `fullDetail: true`** to keep that behavior. If you only need id, title, icon, url, price, developer, etc., use the default and type as `ListApp[]`.

---

## 2. Error handling: use `HttpError` for HTTP failures

**v2.x:** Non-OK responses could be detected by parsing `error.message` (e.g. "status 404", "App not found (404)").

**v3.0:** All HTTP failures from `doRequest()` throw an **`HttpError`** (extends `Error`) with `status` and optional `url`. **`ratings()`** throws `HttpError` when the ratings response body is empty: **`status: 204`** (No Content), message `"No ratings data returned"` — so "no data" is distinct from real HTTP 404. **String matching on `error.message` is no longer supported** — the message text may change. Use `err instanceof HttpError && err.status === 404` for 404, and `err.status === 204` for empty-body cases (e.g. ratings).

```typescript
import { app, HttpError } from '@perttu/app-store-scraper';

try {
  await app({ id: 123 });
} catch (err) {
  if (err instanceof HttpError && err.status === 404) {
    // app not found
  }
  throw err;
}
```

**Migration:** Replace `error.message.includes('status 404')` and any other message-based checks with `err instanceof HttpError && err.status === 404`. Do not rely on the exact `message` text. If you call `ratings()` and treat "no ratings data" as non-fatal, handle `HttpError` with `status === 204` (empty body) and/or `status === 404` (endpoint not found).

---

## 3. Request behavior: timeout and retries

**v3.0:** All requests use a **15s timeout** by default. **Retries default to 0** (single attempt). To enable retries on 429/503/network errors, set `requestOptions.retries` (e.g. `2`). Configure via `requestOptions.timeoutMs` and `requestOptions.retries`.

**Migration:** If you rely on no timeout or on previous retry behavior, set `requestOptions.timeoutMs` and/or `requestOptions.retries` explicitly.

---

## 4. Rating and review scores

**v3.0:** `App.score`, `App.currentVersionScore`, and `Review.score` use **0 as the sentinel** for unknown/unavailable. Valid range is **0–5** (no longer clamping missing values to 1). Rating `"0"` from the feed is treated as 0, not 1.

**JSDoc correction:** In v3 the JSDoc for `App.score` and `App.currentVersionScore` was corrected to match the implementation (and the original facundoolano/app-store-scraper JS library): **score** = average rating for all versions, **currentVersionScore** = average rating for the current version. Previously the comments were reversed; runtime behavior was always correct. If you coded against the old descriptions, update your understanding accordingly.

**Migration:** If you assumed "no data" was 1, treat 0 as unknown/unavailable. Documented in types and JSDoc.

---

## 5. Other behavioral and type changes

- **similar():** Only 404 is treated as "no similar apps"; other errors (timeout, 5xx, rate limit) are **rethrown**. Code that previously received an empty array on any failure will now get an exception unless the failure was 404.
- **app() with ratings:** Only 404 (including ratings empty-body) from the ratings request is treated as "no histogram"; other errors are **rethrown**. Callers that relied on getting an app without histogram on timeout/5xx will now get an exception.
- **app() with screenshots:** Only 404 from the screenshot request is treated as "no screenshots" (empty arrays); other errors (timeout, 5xx, parse) are rethrown.
- **Screenshot URLs:** Original image format (webp/jpg/png) is preserved; PNG is no longer forced. **Migration:** If you assumed URLs always ended in `.png`, handle other extensions (e.g. `.webp`, `.jpg`).
- **search():** The `console.warn` when `page * num > 200` was removed; the 200-result cap is unchanged. If you depended on that warning (e.g. in tests or logging), remove that assumption.
- **search() pagination:** Previously, `search({ term, num: 50, page: 2 })` requested only `limit=50` from the API (first 50 results) then sliced for page 2, so page 2 and beyond always returned empty. v3.0 requests `limit=page * num` (e.g. 100 for page 2 with `num: 50`) and correctly returns results 50–99. This **fixes** broken pagination; code that relied on page &gt; 1 being empty, or tests asserting empty page-2 results, will see different behavior.
- **versionHistory():** Uses structural DOM selectors instead of Svelte class hashes; behavior unchanged but implementation more resilient.
- **SuggestOptions:** `country` (and `lang`) are no longer on the type; suggest uses a global hints endpoint and never used them. TypeScript callers passing `country` will get a type error; runtime behavior is unchanged.

---

## 6. `ListApp.developerId` — number only, `developerIdNum` removed

**v3.0:** `ListApp` has a single **`developerId: number`** (0 when unknown), matching `App.developerId`. The former `developerId: string` and **`developerIdNum`** have been removed.

**Migration:** Use `ListApp.developerId` as a number. If you used `developerIdNum`, switch to `developerId`. If you used `developerId` as a string, use the numeric `developerId` instead.

---

## 7. `App.size` — number (bytes)

**v2.x:** `App.size` was a **string** (e.g. `"12345678"`), so consumers had to `parseInt(app.size, 10)` for arithmetic or display.

**v3.0:** `App.size` is a **number** (bytes). Same semantics; type matches the field name and avoids repeated parsing.

**Migration:** If you used `app.size` as a string, it is now a number. Remove any `parseInt(app.size, 10)` (or `Number(app.size)`) and use `app.size` directly.

---

## 8. Genre IDs — numeric (`genreIds`, `primaryGenreId`, `ListApp.genreId`)

**v2.x:** `App.genreIds` was **`string[]`**, `App.primaryGenreId` was **`string`**, and `ListApp.genreId` was **`string`**. The API returns numbers; the library converted them to strings.

**v3.0:** All are **numeric**: `App.genreIds` is **`number[]`**, `App.primaryGenreId` is **`number`** (0 when unknown), and `ListApp.genreId` is **`number`** (0 when unknown). This aligns with the iTunes API and with the `category` constants (e.g. `category.GAMES` is `6014`), so you can compare directly without parsing.

**Silent wrong-result in JavaScript:** Code that still treats these as strings does not throw — it just returns the wrong result. For example, `app.genreIds.includes('6014')` is always `false` (array of numbers never includes a string), and `app.primaryGenreId === '6014'` is always `false`.

**Migration — before/after for ID comparisons:**

```typescript
// v2.x (strings)
if (app.genreIds.includes('6014')) { /* games */ }
if (app.primaryGenreId === '6014') { /* games */ }

// v3.x (numbers) — use numeric literals or category constants
if (app.genreIds.includes(6014)) { /* games */ }
if (app.primaryGenreId === 6014) { /* games */ }
// or: if (app.primaryGenreId === category.GAMES) { ... }
```

If you used genre IDs as strings elsewhere (e.g. `app.genreIds.map(id => ...)` or string keys), use them as numbers. Remove any `Number(app.primaryGenreId)` or `parseInt(app.genreId, 10)` and use the values directly.

---

## 9. `App.contentRating` — default `''` when unknown (no longer `'4+'`)

**v2.x:** When the API did not return a content rating, the library defaulted to **`'4+'`** (everyone), which could incorrectly imply the app was rated for all ages.

**v3.0:** When the API does not return a rating, **`contentRating`** is **`''`** (empty string = unknown). Only values from the API (e.g. `"4+"`, `"12+"`, `"17+"`) are returned.

**Migration:** If you treated `contentRating === '4+'` as "safe for all ages", note that missing data now yields `''`. Check `app.contentRating === ''` for unknown and handle accordingly (e.g. do not assume 4+).

---

## 10. Input validation — new failure mode before any request

**v2.x:** Invalid options (e.g. `country: 'xx'`, `collection: 'invalid'`, out-of-range `num` or `page`) were passed through to Apple. You might get an HTTP error, empty results, or undefined behavior depending on the endpoint.

**v3.0:** All public functions validate **`country`**, **`collection`**, **`category`**, **`sort`**, **`num`**, and **`page`** against allowlists (see `src/lib/validate.ts`). **Invalid values throw a synchronous `Error`** (e.g. `Error: Invalid country: "xx"`) **before any HTTP request**. This is a different code path from HTTP failures: validation errors are plain `Error`, not `HttpError`.

**Impact:** Code that previously caught only HTTP/API errors may now receive validation errors earlier. For example, `list({ country: 'xx' })` no longer hits the network; it throws immediately. If you catch and retry or log "API errors", ensure validation errors are handled or rethrown as appropriate.

**Migration:** Validate or sanitize user-supplied options before calling the library, or catch both `Error` (validation) and `HttpError` (HTTP) if you need to handle all failures in one place. Do not rely on invalid options being sent to Apple.

---

## Planning more breaking changes?

For considered or future changes, see the [CHANGELOG](../CHANGELOG.md) and [DEV-DECISIONS.md](DEV-DECISIONS.md) (includes decisions we chose *not* to make for v3).
