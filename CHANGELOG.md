# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **sideEffects: false:** Package declares no side effects so bundlers can tree-shake unused exports. Resolves CODE-REVIEW C4.
- **search() device filter:** Optional `device` option (`device.IPAD`, `device.MAC`, or `device.ALL`) to filter search results by store. Passed to the iTunes Search API as `entity`. Invalid values throw `Invalid device: "..."`. Resolves CODE-REVIEW P1 (device constant was exported but no method accepted it).

### Fixed

- **Vitest watch mode:** Explicit `pool: 'forks'` in vitest.config.ts to avoid "Failed to Terminate Worker" and watch-mode hangs when using Node fetch (tests mock `globalThis.fetch`). Resolves CODE-REVIEW C3.
- **CJS TypeScript consumers:** Exports map now nests `types` under `import`/`require` so CJS consumers get `index.d.cts` and ESM consumers get `index.d.ts`. Resolves CODE-REVIEW P3.
- **doRequest retries:** Invalid `retries` values (e.g. `-1`, `NaN`) are now clamped to 0 so one request is always attempted instead of throwing a generic "Request failed" with no HTTP call. Resolves CODE-REVIEW P1 item 6.
- **doRequest timeoutMs:** Invalid `timeoutMs` (e.g. `0`, negative, `NaN`, `Infinity`) now throws a clear error before any request instead of a cryptic `RangeError` from `AbortSignal.timeout()`. Resolves CODE-REVIEW P1 item 7.
- **similar (TEST-4):** Added fixture-based unit tests for section heading detection and link extraction. `getLinkTypeFromHeadingText()` is now exported and tested for all `SECTION_PATTERNS` (customers-also-bought, more-by-developer, you-might-also-like, similar-apps, other); one HTML snippet test exercises cheerio parsing of headings and `/app/id` links so markup changes can be caught.
- **screenshots (TEST-3):** Added fixture-based unit tests for `extractScreenshotUrl` and App Store screenshot HTML parsing. `screenshots.test.ts` now has a `unit (fixtures)` suite that runs in CI (no network); regression in srcset regex or cheerio selectors will be caught.
- **RSS list feed:** `im:image` now accepts either a single image object or an array (same pattern as `link`). Avoids validation failure if the API returns a single object; `list()` normalizes to array when resolving the icon URL.
- **ratings() histogram:** Documented assumption that bars are in 5→1 order; sanity check that histogram sum equals total count now logs a warning (no throw) when mismatch detected; parsed result is still returned. Does not detect order flip without per-row labels (see CODE-REVIEW BUG-C).
- **list() developerId:** Parsing no longer breaks when the developer URL slug contains "id" (e.g. `identity-games`, `idle-corp`). Replaced string split on `/id` with regex `/\/id(\d+)/` so only `/id` followed by digits is matched.
- **fileSizeBytes schema:** iTunes API sometimes returns `fileSizeBytes` as a number; schema now accepts `string | number` to avoid validation failures. Resolves CODE-REVIEW B3.
- **HttpError:** Added `Object.setPrototypeOf(this, HttpError.prototype)` so `instanceof HttpError` works correctly after transpilation to ES5. Resolves CODE-REVIEW E5.

## [3.0.0] - Unreleased

**v3.0.0 release:** See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) for upgrade guidance.

### Documentation

- **README:** Node.js ≥20 requirement; Development section with commands for unit tests (`npm run test`), coverage (`npm run test:coverage`), and optional integration tests (`RUN_INTEGRATION_TESTS=1 npm run test`).
- **Review.score:** JSDoc and `reviews.ts` document that 0 means missing or invalid (unparseable/absent); valid ratings are 1–5. Consumers should treat 0 as "no rating."
- **README:** Country uses a static allowlist (no fallback); new Apple storefronts require a library patch.

### Added

- **Security/allowlists:** Runtime validation for `country`, `collection`, `category`, and `sort` against allowlists before URL interpolation. Invalid values throw clear errors (e.g. `Invalid country: "xx"`). Shared helpers in `src/lib/validate.ts`; used at the start of `list`, `search`, `app`, `ratings`, `reviews`, `similar`, `privacy`, `versionHistory`, and `developer`. README documents that only supported values are accepted.
- **Tests:** Unit tests for `suggest()` (single vs array dict), `search()` pagination cap, validate allowlists, `list()` ListApp shape, `app()` not found; reviews/ratings/schema fixtures. Live API tests skipped by default; run `npm run test:integration` for full suite. npm script `test:coverage`.
- **Docs:** `docs/CODEBASE-REVIEW.md`, `docs/TESTING-REVIEW.md`, `docs/COMPARISON-WITH-APP-STORE-SCRAPER-JS.md`, `docs/DEV-DECISIONS.md`, `docs/TESTING-AND-TOOLING-RECOMMENDATIONS.md`.
- **search() overloads:** `search()` has overloaded signatures so return type narrows by `idsOnly`: `search(options & { idsOnly: true })` returns `Promise<number[]>`, otherwise `Promise<App[]`. Non-breaking.
- **HttpError:** `doRequest()` throws `HttpError` (extends `Error`) on non-OK responses, with `status` and optional `url`. Export: `import { HttpError } from '@perttu/app-store-scraper'`.
- **similar() link type:** `similar({ ..., includeLinkType: true })` returns `SimilarApp[]` (each item has `app` and `linkType`). New types: `SimilarApp`, `SimilarLinkType`, `ListApp` (lightweight shape from list RSS; returned by `list()` when `fullDetail` is false).
- **resolveAppId():** Lightweight helper to resolve a bundle ID to a numeric track ID via a single iTunes lookup. Exported from the package. `similar()` and `reviews()` now use it when given `appId` instead of calling the full `app()` (which could also run screenshot scraping and ratings).

### Fixed

- **CI:** Added missing `@vitest/coverage-v8` so `test:coverage` succeeds; removed duplicate test run so CI runs only `test:coverage`, halving test time.
- **app() screenshots:** Only 404 treated as "no screenshots" (empty arrays); other errors rethrown. Same pattern for **app() ratings** and **similar()**: only 404 is soft-fail; timeouts, 5xx, etc. rethrown.
- **list():** Removed unsafe double cast and redundant `ListFeedEntryShape`; list logic uses Zod-inferred `RssFeedEntry` from `rssFeedEntrySchema` so types stay in sync with the schema.
- **list() price:** Non-numeric `im:price` amount (e.g. `"free"`) now yields `price: 0` and `free: true` instead of `NaN` and `free: false`.
- **ratings():** When the response is 200 but body is empty, throws `HttpError` with `status: 204` (No Content) so retry/monitoring can distinguish "no data" from "not found." `app()` treats both 404 and 204 as "ratings unavailable" and continues without histogram.
- **versionHistory():** Structural selectors instead of Svelte-generated classes; only push entries when article has `time[datetime]` (excludes other dialogs).
- **similar():** Only collect app links after the first recognized "similar" section heading (e.g. "Customers Also Bought", "More from Developer"); avoids breadcrumb or navigation `/app/` links as false positives. With `includeLinkType: true`, deduplicate by `(id, linkType)` so the same app appears once per section.
- **suggest():** Single-dict response no longer dropped (normalize with `ensureArray`); schema accepts single dict or array. XMLParser hoisted to module singleton.
- **App type JSDoc:** Corrected reversed descriptions for `score`/`reviews` (all versions) and `currentVersionScore`/`currentVersionReviews` (current version) in `src/types/app.ts` to match `cleanApp()`. **score** = all versions, **currentVersionScore** = current version; runtime behavior was always correct.
- **reviews():** Missing or empty `im:rating` now yields `score` 0 (was clamped to 1). Missing and unparseable ratings use 0 as sentinel; valid numeric ratings clamped to 0–5.
- **search() pagination:** Cap API `limit` at 200 (iTunes Search API maximum). When `page * num > 200`, request is capped so later pages may have fewer results or be empty. Pagination for page > 1 fixed (request and slice client-side). Test for 200-item cap now asserts `results.length === 0` when requested page is beyond cap.
- **app():** Removed redundant unreachable check for `id`/`appId`; `validateRequiredField` already enforces one of them.
- **cleanApp():** Use `??` for `price`, `free`, `reviews`, `currentVersionReviews` so 0 is preserved where valid.
- **Zod 4:** `.passthrough()` → `z.looseObject()` for iTunes and RSS schemas. TypeScript: DOM lib for URLSearchParams; explicit types for search callbacks.
- **tsconfig:** Removed unnecessary `"DOM"` from `lib`; project is Node-only (fetch typed via `@types/node`).
- **Unit test mocks:** Replaced passthrough `doRequest` mocks in `suggest.test.ts`, `search.test.ts`, and `list.test.ts` with `vi.fn()` so tests that omit `mockResolvedValueOnce` do not hit the network. Integration tests under `RUN_INTEGRATION_TESTS` restore real `doRequest` via `vi.importActual`. **list.test.ts:** use `mockReset` (not `mockClear`) in allowlist-validation `beforeEach` to avoid cross-test leakage.
- **reviews() page:** `page` is now validated with `validateReviewsPage()` (integer and 1–10 range); `page: 1.5` and out-of-range values throw before the request. Aligns with `search()` and `list()` pagination validation.
- **SuggestOptions:** Type no longer includes `country`; suggest uses a global hints endpoint and does not take a country parameter, so the option was removed from the type to match behavior.
- **ID validation:** Required `id`/`devId` checks now use `== null` instead of truthiness, so passing `0` yields a clear validation error instead of "id is required" (developer, ratings, privacy, version-history, reviews, similar).
- **Null/undefined checks:** Standardized on `== null` for null/undefined; `ensureArray` and `reviews()` now use it. Search/suggest required `term` use `term == null || term === ''` so empty string is rejected explicitly.
- **search() / list() pagination:** `num` and `page` are now validated so invalid values throw before calling the API. `list()`: `num` must be an integer in 1–200. `search()`: `num` and `page` must be positive integers. Aligns with `reviews()` which already validates `page` 1–10.
- **Default value operators:** Standardized `||` vs `??`: numbers use nullish coalescing (or NaN-safe fallback) so `0` is preserved; strings use `||`; optional objects in `ratings.ts` use `??`. See `docs/CODE-REVIEW.md` §2.
- **Type coercion:** Integer parsing standardized on `parseInt(value, 10)` with explicit `Number.isNaN()` checks (no `Number(x) || 0`). Applied to genre IDs in `common.ts` and `list.ts`, primaryGenreId, and srcset width in `app.ts`. See `docs/CODE-REVIEW.md` §5.

### Changed

- **404 handling:** `privacy()` and `versionHistory()` now return empty `{}` and `[]` when the app page returns 404 (app not found), matching `similar()` and the screenshot/ratings parts of `app()`. Callers no longer get different behavior for the same nonexistent app (addresses CODE-REVIEW §2).
- **App page URL:** Extracted shared `appPageUrl(country, appId)` in `common.ts`; `app`, `similar`, `privacy`, and `versionHistory` now use it instead of duplicating the URL template (addresses CODE-REVIEW §7).
- **CODE-REVIEW §1, §5, §8:** `cleanApp` and related defaults now use `??` instead of `||` for null/undefined-only fallbacks; `ensureArray` uses a single expression; validation order is consistent (required params first, then `validateCountry`, then other validations) in `privacy()` and `versionHistory()`.
- **Request/doRequest():** Default timeout 30s → 15s. All requests use `AbortSignal.timeout(timeoutMs)`; retries opt-in (`retries: 0`); error message includes request URL. See `RequestOptions` (exported). See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) §2 for error-handling migration.
- **Error handling:** Standardized on `HttpError`; use `instanceof HttpError && err.status === 404` (or 204) instead of message parsing.
- **Vitest:** `globals: false`; explicit imports only. Removed `console.warn` when search `page * num > 200`.
- **Screenshots:** Preserve original format (webp/jpg/png); use `Set` for URL deduplication. **list.ts:** Redundant type annotation removed (inferred from schema).
- **list() return type and behavior:** Overloaded signatures so return type narrows by `fullDetail`: `list(options & { fullDetail: true })` returns `Promise<App[]>`, otherwise `Promise<ListApp[]>`. When `fullDetail` is false (default), list is built only from RSS (one request); when true, full app details fetched via lookup. In v2, `fullDetail` was a no-op; v3 makes it meaningful — use `fullDetail: true` if you need full detail from `list()`. See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) §1.
- **Type changes (breaking):** ListApp.developerId → `number` (developerIdNum removed). App.size → `number` (bytes). Genre IDs → `number[]`/`number`. App.contentRating → `''` when unknown. See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) §6–9.
- **RequestOptions:** Documented and exported; README note.
- **Docs:** CODE-REVIEW.md and TESTING-AND-TOOLING-RECOMMENDATIONS updated. `privacy()` and `versionHistory()` documented as DOM-dependent (may break). Default country: `DEFAULT_COUNTRY` constant (exported). Rating sentinel: 0 = unknown; range 0–5; `reviews()` no longer clamps feed `"0"` to 1.
- **CI:** `npm run test:coverage` after unit tests; optional integration job. Vitest 4.0.18.

### Removed

- **Dead schemas:** Removed unused Zod schemas and inferred types from `src/lib/schemas.ts`: `privacyDetailsSchema`, `privacyTypeSchema`, `ampApiResponseSchema`, `versionHistoryEntrySchema`, `versionHistoryResponseSchema`, `similarAppsSchema`, and types `AmpApiResponse`, `VersionHistoryResponse`, `SimilarApps`. Privacy, version-history, and similar modules use HTML scraping only; schema tests cover used schemas.

## [2.0.1] - 2024

### Fixed

- Screenshot scraping: add fallback when iTunes API returns empty screenshot arrays.

## [2.0.0] - 2024

### Breaking changes

- Major updates to scraping behavior and types; see commits and PRs for full details.

### Fixed

- Scraping for `ratings()`, `versionHistory()`, and `privacy()` (HTML/API fallbacks).
- `versionHistory()` now scrapes from HTML when needed.
- `ratings()` behavior aligned with original implementation.

### Removed

- Unused memoization and rate-limiting code (use external throttling/memoization if needed).

## [1.0.3] - 2024

### Changed

- README and project name updates.

## [1.0.2] - 2024

### Fixed

- Package name correction.

---

Earlier releases (1.0.1 and before) were part of the initial TypeScript rewrite and migration from the original app-store-scraper.

[Unreleased]: https://github.com/plahteenlahti/app-store-scraper/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/plahteenlahti/app-store-scraper/compare/v2.0.1...v3.0.0
[2.0.1]: https://github.com/plahteenlahti/app-store-scraper/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/plahteenlahti/app-store-scraper/compare/v1.0.3...v2.0.0
[1.0.3]: https://github.com/plahteenlahti/app-store-scraper/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/plahteenlahti/app-store-scraper/compare/v1.0.1...v1.0.2
