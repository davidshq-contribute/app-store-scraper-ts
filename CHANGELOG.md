# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **CI:** Added missing `@vitest/coverage-v8` devDependency so `npm run test:coverage` (and the CI coverage step) succeeds.
- **app() screenshot scraping (PRACTICE-1):** `scrapeScreenshots()` now rethrows non-404 errors (timeout, 5xx, parse, etc.); only 404 is treated as "no screenshots" and returns empty arrays, matching ratings and similar() behavior.
- **list() (TYPE-3):** Removed unsafe double cast and redundant `ListFeedEntryShape` in `list.ts`; list logic now uses Zod-inferred `RssFeedEntry` from `rssFeedEntrySchema` so types stay in sync with the schema.
- **ratings() (FRAGILE-4):** When the response body is empty, throw `No ratings data returned for app ${id}` instead of `App not found (404)` so the error does not imply a 404 when the cause may be rate limiting, auth, or server error. **app()** now treats this new message as "ratings unavailable" and continues without histogram (same behavior as before for empty body).
- **versionHistory() (FRAGILE-1):** Replaced Svelte-generated class selectors (`svelte-13339ih`) with structural selectors (`dialog[data-testid="dialog"] article`, `article > h4`, `article > p`) so the scraper does not break when Apple redeploys their frontend.
- **similar() with includeLinkType: true:** Deduplicate by `(id, linkType)` so the same app in the same section (e.g. multiple `<a>` tags for one app) appears only once per section (CODE-REVIEW-STAGED BUG).
- **suggest() (PRACTICE-6):** Hoist `XMLParser` to module scope as a singleton instead of instantiating on every call.
- **App type JSDoc (TYPE-4):** Corrected reversed descriptions for `score`/`reviews` (all versions) and `currentVersionScore`/`currentVersionReviews` (current version) in `src/types/app.ts` to match `cleanApp()` in `src/lib/common.ts`.
- **reviews() (BUG-1):** Missing or empty `im:rating` now yields `score` 0 (was parsed as 0 and clamped to 1). Both missing and unparseable ratings use 0 as the sentinel; valid numeric ratings are clamped to 0–5 (feed may send "0").
- **`similar()` (BUG-5):** No longer swallows all HTTP errors. Only 404 (app page not found) is treated as "no similar apps" and returns `[]`; other errors (timeout, 500, rate limiting, etc.) are rethrown so callers can distinguish request failures from empty results.
- **`app()` ratings (PRACTICE-1):** When `ratings: true`, only 404 / "App not found" from the ratings request is treated as "no histogram available"; other errors (timeout, 500, etc.) are rethrown instead of being silently swallowed.
- **`search()` pagination (BUG-3):** Cap API `limit` at 200 (iTunes Search API maximum). When `page * num > 200`, emit a console warning and still cap the request so later pages are not silently empty.
- **`app()`:** Remove redundant unreachable check for `id`/`appId`; `validateRequiredField` already enforces one of them (BUG-4).
- Zod 4: replace deprecated `.passthrough()` with `z.looseObject()` for `iTunesAppResponseSchema` and `rssFeedEntrySchema`.
- Search pagination now works correctly for page > 1 (request `page * num` results and slice client-side).
- TypeScript: resolve `URLSearchParams` by including DOM lib in `tsconfig.json`.
- TypeScript: add explicit types for search result callbacks (`ITunesAppResponse`) to satisfy `noImplicitAny`.

### Changed

- **doRequest() (PRACTICE-2):** All requests now use a 30s timeout via `AbortSignal.timeout(30_000)` by default. Optional retry for transient failures: on 429, 503, or network errors, retries up to 2 times with exponential backoff (1s, 2s). Configure via `requestOptions.timeoutMs` and `requestOptions.retries` (set `retries: 0` to disable). See `RequestOptions` in `src/types/options.ts`.
- **doRequest() (PRACTICE-3):** Error message now includes the request URL (e.g. `Request to <url> failed with status 404`) so failed requests can be identified when multiple are in flight.
- **list.ts:** Removed redundant `RssFeedEntry` type annotation on `.map()` callback; type is inferred from schema-validated `entries`.
- **Screenshot URL normalization (FRAGILE-3):** Preserve original image format (webp/jpg/png) instead of forcing PNG; document why 392x696 is used (2x iPhone logical size, consistent URL).
- **Screenshot deduplication (PERF-2):** Use `Set` instead of array `.includes()` when collecting screenshot URLs in `scrapeScreenshots()` for O(1) deduplication; return type remains arrays.
- **list() return type:** Overloaded signatures so return type narrows by `fullDetail`: `list(options & { fullDetail: true })` returns `Promise<App[]>`, and `list(options?)` with `fullDetail` false or omitted returns `Promise<ListApp[]>` (CODE-REVIEW TYPE-2).
- **ListApp developer ID (TYPE-1, backwards compatible):** `developerId` remains `string` (empty when unknown). Added `developerIdNum: number` (0 when unknown) so code can use a single numeric field for both `ListApp` and `App`; prefer `developerIdNum` for type alignment.
- **RequestOptions (DOC-1):** Documented `RequestOptions` in JSDoc (supported: `headers`; possible future: e.g. `signal`) and added a "Request options" note in the README. Exported `RequestOptions` from the package (`src/types/index.ts` and `src/index.ts`) so consumers can `import type { RequestOptions } from '@perttu/app-store-scraper'`.
- **CODE-REVIEW.md:** Updated to reflect current codebase: line numbers corrected, BUG-2 / TYPE-4 / DOC-1 / PRACTICE-4 marked addressed; Bugs section notes none remaining; Action Priority table and Documentation section updated accordingly.
- **Docs:** Documented that `privacy()` and `versionHistory()` rely on Apple’s DOM and may break; no tests for these until selectors are stabilized (FRAGILE-1, FRAGILE-2). See README (API note) and `docs/DEV-DECISIONS.md`.
- **CI (TESTING-AND-TOOLING 2.2):** Main CI workflow now runs `npm run test:coverage` after unit tests and adds an optional `integration` job that runs `npm run test:integration` (with network). No coverage threshold; add `coverage.linesThreshold` later if needed.
- **Default country:** Centralized as `DEFAULT_COUNTRY` in `src/types/constants.ts`; all methods that default `country` to `'us'` now use this constant. Exported from the package for consistency.
- **Rating scores:** `0` is the documented sentinel for unknown/unavailable rating. `App.score`, `App.currentVersionScore`, and `Review.score` are 0 when the value is missing or unparseable; otherwise 1–5. Types and implementation comments updated accordingly.
- **reviews() score:** Rating `"0"` from the feed is no longer clamped to 1; valid score range is 0–5. Sentinel 0 still used for missing/unparseable.
- Upgraded Vitest from ^1.0.4 to 4.0.18 (dev dependency).
- **List "light" mode:** When `list({ fullDetail: false })` (default), the list is built only from the RSS feed (one request) and returns the lighter `ListApp` shape. When `fullDetail: true`, full app details are fetched via lookup and `App[]` is returned. This matches app-store-scraper-js semantics and reduces requests when full detail is not needed.
- **Docs:** TESTING-AND-TOOLING-RECOMMENDATIONS – updated to reflect current codebase: test layout (reviews, ratings, schemas tests; integration gating via `runIntegrationTests`), tooling (`test:coverage`, `test:integration`), recommendations marked implemented (schema tests, BUG-2 ratings histogram, reviews score parsing, similar() error propagation), sections 2.1/2.2 and priority order revised.

### Removed

- **Dead schemas (PRACTICE-4):** Removed unused Zod schemas and their inferred types from `src/lib/schemas.ts`: `privacyDetailsSchema`, `privacyTypeSchema`, `ampApiResponseSchema`, `versionHistoryEntrySchema`, `versionHistoryResponseSchema`, `similarAppsSchema`, and types `AmpApiResponse`, `VersionHistoryResponse`, `SimilarApps`. Privacy, version-history, and similar modules use HTML scraping only; schema tests cover used schemas.


### Added

- **Unit tests for known bugs (CODE-REVIEW / TESTING-AND-TOOLING-RECOMMENDATIONS):** reviews (BUG-1) – mocked feed tests for score parsing when `im:rating` is missing or unparseable; ratings (BUG-2) – `parseRatings()` exported, histogram sliced to 5 elements, fixture HTML tests; search (BUG-3) – unit test that when `page * num > 200`, `search()` warns and requests `limit=200`.
- **Schema validation tests:** `src/__tests__/schemas.test.ts` – fixture-based tests for `reviewsFeedSchema`, `iTunesLookupResponseSchema`, and `rssFeedSchema`; asserts `safeParse` succeeds on valid fixtures and fails on invalid ones (wrong types, missing required fields). No network required; prevents regressions when schemas change.
- **`similar()` link type:** `similar({ ..., includeLinkType: true })` returns `SimilarApp[]` (each item has `app` and `linkType`) so you can tell which section a link came from (e.g. `customers-also-bought`, `more-by-developer`, `you-might-also-like`, `other`). Default remains `App[]` for backward compatibility.
- `SimilarApp` and `SimilarLinkType` types.
- `ListApp` type – lightweight app shape from list RSS (id, appId, title, icon, url, price, currency, free, description, developer, developerUrl, developerId, developerIdNum, genre, genreId, released). Returned by `list()` when `fullDetail` is false.
- `docs/COMPARISON-WITH-APP-STORE-SCRAPER-JS.md` – comparison with facundoolano/app-store-scraper (observations and recommendations).
- `docs/DEV-DECISIONS.md` – record of design/implementation decisions (e.g. API vs HTML scraping for privacy/version history; public iTunes Search API vs MZStore for search).
- `docs/TESTING-AND-TOOLING-RECOMMENDATIONS.md` – pragmatic review of tests and tooling with recommendations (add/update/edit/delete, priorities, YAGNI).
- npm script `test:coverage` (`vitest run --coverage`) for running coverage locally and in CI.
- **Tests without network:** Tests that call live iTunes/App Store APIs are skipped by default so `npm run test` / `npm run test:run` pass in environments without network (e.g. sandbox, CI without outbound access). Run `npm run test:integration` (or set `RUN_INTEGRATION_TESTS=1`) to run the full suite including live API tests.

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

[Unreleased]: https://github.com/plahteenlahti/app-store-scraper/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/plahteenlahti/app-store-scraper/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/plahteenlahti/app-store-scraper/compare/v1.0.3...v2.0.0
[1.0.3]: https://github.com/plahteenlahti/app-store-scraper/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/plahteenlahti/app-store-scraper/compare/v1.0.1...v1.0.2
