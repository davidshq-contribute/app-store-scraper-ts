# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **DRY (Option B):** Add `wrapResolveAppIdError(appId, err)` in `common.ts` to centralize the resolveAppId catch block. Use in `privacy.ts`, `version-history.ts`, `similar.ts`, `reviews.ts`, and `app-page-details.ts`.
- **DRY (fetchAppPage):** Add `fetchAppPage(url, requestOptions)` in `common.ts`; on 404 returns `null` so callers return their empty value. Use in `privacy.ts`, `version-history.ts`, `similar.ts`, and `app-page-details.ts`.
- **doRequest retry consistency:** Use `backoffMs(attempt)` in the catch block so both retry paths (HTTP errors and network errors) use the same jittered backoff.
- **DRY (parseAndValidate):** Add `parseAndValidate(body, schema, context)` in `common.ts` to centralize parseJson + Zod safeParse + ValidationError. Use in `lookup`, `reviews`, `list`, and `search`.
- **validateRequiredField (CODE_SMELLS §2):** `validateRequiredField` in `src/lib/common.ts` now accepts a generic `<T extends object>` so callers can pass typed options without casting. Removed `options as Record<string, unknown>` from `app.ts`, `reviews.ts`, and `similar.ts`. List/suggest (CODE_SMELLS §1) already throw `ValidationError` with `field: 'response'` for API response validation.
- **storeId fallback (CODE_SMELLS §4):** In `src/lib/common.ts`, `storeId()` now uses only `DEFAULT_STORE_FRONT_ID` as fallback when the country is unknown (removed redundant `markets.us` from the chain). The constant remains documented in `src/types/constants.ts` as the US store front.
- **Type safety (CODE_SMELLS §3):** In `doRequest` catch block, use a `hasStatus` type guard instead of `(err as { status?: number }).status` for retry logic. In `parseRatings`, derive histogram star key via `STAR_KEYS[4 - index] ?? 1` instead of a type assertion.
- **Constants:** Add `ITUNES_API_MAX_LIMIT` (200) and `BODY_PREVIEW_MAX_LEN` (200) in `src/types/constants.ts`; use in `search.ts`, `list.ts`, `validate.ts`, and `common.ts` to remove duplicate magic numbers (per docs/CODE_SMELLS.md §8).

- **ratings() empty body:** When the response is 200 OK but body is empty, now throws `HttpError` with `status: 200` (actual response) and message `RATINGS_EMPTY_MESSAGE` instead of synthetic 204, so HTTP semantics are not conflated with application-level "no data." Export `RATINGS_EMPTY_MESSAGE` for consumer checks; `app()` treats 404 or 200 + this message as "ratings unavailable" (per CODE-REVIEW-FIXES-3 §8).
- **API response validation:** `lookup()` (common.ts), `reviews()`, and `search()` now throw `ValidationError` with `field: 'response'` when API response schema validation fails, so consumers can distinguish bad API responses from other errors (per CODE-REVIEW-FIXES-3 §4).
- **Tests:** `suggest.test.ts` and `ratings.test.ts` now assert `ValidationError` type (and, for ratings, a test for missing `id`) so validation errors are checked by type, not only message (per CODE-REVIEW-FIXES-3 §5).
- **package.json:** Remove redundant `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser`; `typescript-eslint` bundles both for flat config (per CODE-REVIEW-FIXES-3).
- **similar.ts:** Use `appId != null` instead of truthiness check so empty string triggers resolution and fails fast, consistent with `reviews.ts` (per CODE-REVIEW-FIXES-3).
- **list.test.ts:** Add tests for empty feed handling (`feed.entry` undefined/empty), URL construction (collection, category, country, limit), link parsing (single object, no alternate), developerId 0 when no href, genreId 0 when category im:id missing (per MUTATION_TESTING_RECOMMENDATIONS.md 2.4).
- **app.test.ts:** Add fixture-based tests for screenshot scraping fallback (empty API → scrape HTML), 404/500 handling in scrape, ratings histogram merge, ratings 404/204 soft-fail, bundleId vs id lookup path (per MUTATION_TESTING_RECOMMENDATIONS.md 2.5).
- **screenshots.test.ts:** Add `extractScreenshotUrl` tests for regex $ anchor (duplicate size pattern in path) and trailing content after extension (per MUTATION_TESTING_RECOMMENDATIONS.md 2.5).
- **search.test.ts:** Add unit tests for `idsOnly` mode (returns `number[]`, filters undefined trackIds), `cleanApp` result transformation (raw iTunes fields → App shape), and explicit entity URL param assertions for iPad/Mac device mapping (per MUTATION_TESTING_RECOMMENDATIONS.md 3.2).
- **reviews.test.ts:** Add tests for sort option/default (URL contains `sortby=mostRecent` or `sortby=mostHelpful`), `appId` resolution path via `resolveAppId`, optional chaining when feed fields are missing, and `ValidationError.field` assertions (per MUTATION_TESTING_RECOMMENDATIONS.md 2.2).
- **common.test.ts:** Add tests for `appPageUrl` URL format, `doRequest` User-Agent header, response body verbatim, 503/429 retries, non-retryable 404 throws immediately, `lookup` URL construction (bundleId/id/artistId params, entity=software), comprehensive `cleanApp` field mapping via lookup, and optional chaining for missing API fields (per MUTATION_TESTING_RECOMMENDATIONS.md 2.3).
- **similar.test.ts:** Add tests for 404/500 HttpError handling, `appId`→`id` resolution via `resolveAppId`, `includeLinkType` branching (plain `App[]` vs `SimilarApp[]`), deduplication of duplicate app IDs, and empty-entries early return (per MUTATION_TESTING_RECOMMENDATIONS.md 2.1).
- **common.test.ts:** Add explicit value assertions for `safeParseInt`, `storeId`, and `ensureArray` so tests kill mutations (per MUTATION_TESTING_RECOMMENDATIONS.md 1.3 — covered 0 tests).
- **errors.test.ts:** Add assertions that `HttpError` has no `field` property and that `ValidationError` is distinct from `HttpError` (improves mutation score per 1.1).
- **validate.test.ts:** Assert `ValidationError.field` for all validators (`validateCollection`, `validateCategory`, `validateDevice`, `validateSort`, `validateReviewsPage`, `validateListNum`, `validateSearchPagination`) to kill StringLiteral mutants on the field parameter (per MUTATION_TESTING_RECOMMENDATIONS.md 1.2).
- **eslint.config.js:** Upgrade `@typescript-eslint/no-explicit-any` from `warn` to `error` (no `any` usages in `src/`).
- **vitest.config.ts:** Add `resolve.tsconfigPaths: true` so Vitest uses project tsconfig for path resolution (aligns with build).

### Breaking Changes

- **`RATINGS_EMPTY_MESSAGE` removed:** The exported `RATINGS_EMPTY_MESSAGE` constant and the `error.message === RATINGS_EMPTY_MESSAGE` matching pattern have been replaced by a dedicated `RatingsEmptyError` class (extends `HttpError`). Consumers should migrate from `error.message === RATINGS_EMPTY_MESSAGE` to `error instanceof RatingsEmptyError`. The new class is exported from the package root.
- **`PrivacyDetails` interface:** Removed `managePrivacyChoicesUrl` and `privacyPolicyText` fields — these were never populated by any parser and always returned `undefined`.

### Documentation

- **docs/PRAGMATIC_ENGINEERING_REVIEW.md:** Pragmatic engineering review covering strengths, improvement areas, prioritized recommendations, and YAGNI items.
- **README, RequestOptions:** Document User-Agent override via `requestOptions.headers` for bot-detection avoidance when the default ages.

## [3.0.0] - 2026-03-12

**v3.0.0 release:** See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) for upgrade guidance.

### Added

- **appPageDetails():** Combined fetcher that retrieves the App Store app page once and parses privacy, similar app IDs, and version history from the same HTML. Use when you need more than one of these to avoid multiple requests. Returns `{ privacy, similarIds, versionHistory }`.
  - See `docs/DEV-DECISIONS.md` (App page consolidation).
- **parsers.ts:** Shared HTML parsing functions (`parsePrivacyFromHtml`, `parseSimilarIdsFromHtml`, `parseVersionHistoryFromHtml`, `getLinkTypeFromHeadingText`) used by `privacy()`, `similar()`, `versionHistory()`, and `appPageDetails()`. Selector changes now only need to be made in one place.
- **sideEffects: false:** Package declares no side effects so bundlers can tree-shake unused exports.
- **search() device filter:** Optional `device` option (`device.IPAD`, `device.MAC`, or `device.ALL`) to filter search results by store. Passed to the iTunes Search API as `entity`. Invalid values throw `Invalid device: "..."`.
- **Security/allowlists:** Runtime validation for `country`, `collection`, `category`, and `sort` against allowlists before URL interpolation. Invalid values throw clear errors (e.g. `Invalid country: "xx"`). Shared helpers in `src/lib/validate.ts`; used at the start of `list`, `search`, `app`, `ratings`, `reviews`, `similar`, `privacy`, `versionHistory`, and `developer`. README documents that only supported values are accepted.
- **Tests:** Unit tests for `suggest()` (single vs array dict), `search()` pagination cap, validate allowlists, `list()` ListApp shape, `app()` not found; reviews/ratings/schema fixtures. Live API tests skipped by default; run `npm run test:integration` for full suite. npm script `test:coverage`.
- **search() overloads:** `search()` has overloaded signatures so return type narrows by `idsOnly`: `search(options & { idsOnly: true })` returns `Promise<number[]>`, otherwise `Promise<App[]`. Non-breaking.
- **HttpError:** `doRequest()` throws `HttpError` (extends `Error`) on non-OK responses, with `status` and optional `url`. Export: `import { HttpError } from '@davidshq/app-store-scraper'`.
- **similar() link type:** `similar({ ..., includeLinkType: true })` returns `SimilarApp[]` (each item has `app` and `linkType`). New types: `SimilarApp`, `SimilarLinkType`, `ListApp` (lightweight shape from list RSS; returned by `list()` when `fullDetail` is false).
- **resolveAppId():** Lightweight helper to resolve a bundle ID to a numeric track ID via a single iTunes lookup. Exported from the package. `similar()` and `reviews()` now use it when given `appId` instead of calling the full `app()` (which could also run screenshot scraping and ratings).

### Documentation

- **Review.score:** JSDoc and `reviews.ts` document that 0 means missing or invalid (unparseable/absent); valid ratings are 1–5. Consumers should treat 0 as "no rating."
- **examples/all-methods.ts:** Add `resolveAppId()` and `appPageDetails()` demos; update summary to list all 12 methods.
- **src/index.ts:** Add module-level JSDoc with export overview and usage example.
- **src/lib/schemas.ts:** Add JSDoc for each Zod schema (purpose, shape, usage).

### Fixed

- **safeParseInt:** Use `value ?? ''` instead of `value ?? 0` so nullish inputs (`null`/`undefined`) yield NaN and correctly fall through to the fallback. Previously `safeParseInt(null, 99)` returned `0` instead of `99`.
- **suggest():** Support Apple's response format: `plist.dict.hints` is an array of strings. Live suggest API currently returns empty hints; integration test skipped until Apple returns data (see docs/POSTPONED.md).
- **Vitest watch mode:** Explicit `pool: 'forks'` in vitest.config.ts to avoid "Failed to Terminate Worker" and watch-mode hangs when using Node fetch (tests mock `globalThis.fetch`).
- **CJS TypeScript consumers:** Exports map now nests `types` under `import`/`require` so CJS consumers get `index.d.cts` and ESM consumers get `index.d.ts`.
- **doRequest retries:** Invalid `retries` values (e.g. `-1`, `NaN`) are now clamped to 0 so one request is always attempted instead of throwing a generic "Request failed" with no HTTP call.
- **doRequest timeoutMs:** Invalid `timeoutMs` (e.g. `0`, negative, `NaN`, `Infinity`) now throws a clear error before any request instead of a cryptic `RangeError` from `AbortSignal.timeout()`.
- **appPageDetails:** Added `app-page-details.test.ts` with fixture-based tests that verify the combined parse matches the individual parsers (`parsePrivacyFromHtml`, `parseSimilarIdsFromHtml`, `parseVersionHistoryFromHtml`) on the same HTML input.
- **similar:** Added fixture-based unit tests for section heading detection and link extraction. `getLinkTypeFromHeadingText()` is now exported and tested for all `SECTION_PATTERNS` (customers-also-bought, more-by-developer, you-might-also-like, similar-apps, other); one HTML snippet test exercises cheerio parsing of headings and `/app/id` links so markup changes can be caught.
- **screenshots:** Added fixture-based unit tests for `extractScreenshotUrl` and App Store screenshot HTML parsing. `screenshots.test.ts` now has a `unit (fixtures)` suite that runs in CI (no network); regression in srcset regex or cheerio selectors will be caught.
- **RSS list feed:** `im:image` now accepts either a single image object or an array (same pattern as `link`). Avoids validation failure if the API returns a single object; `list()` normalizes to array when resolving the icon URL.
- **list() developerId:** Parsing no longer breaks when the developer URL slug contains "id" (e.g. `identity-games`, `idle-corp`). Replaced string split on `/id` with regex `/\/id(\d+)/` so only `/id` followed by digits is matched.
- **fileSizeBytes schema:** iTunes API sometimes returns `fileSizeBytes` as a number; schema now accepts `string | number` to avoid validation failures.
- **HttpError:** Added `Object.setPrototypeOf(this, HttpError.prototype)` so `instanceof HttpError` works correctly after transpilation to ES5.
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
- **Default value operators:** Standardized `||` vs `??`: numbers use nullish coalescing (or NaN-safe fallback) so `0` is preserved; strings use `||`; optional objects in `ratings.ts` use `??`.
- **Type coercion:** Integer parsing standardized on `parseInt(value, 10)` with explicit `Number.isNaN()` checks (no `Number(x) || 0`). Applied to genre IDs in `common.ts` and `list.ts`, primaryGenreId, and srcset width in `app.ts`.

### Changed

- **ratings() histogram:** When sum does not match total count, return `warnings: [message]` on `Ratings` instead of `console.warn`. Consumers control logging; `Ratings` gains optional `warnings?: string[]`. Documented assumption that bars are in 5→1 order; does not detect order flip without per-row labels.
  - See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) §11.
- **cleanApp():** Extract `safeParseInt(value, fallback)` helper to replace IIFEs for `primaryGenreId`, `size`, and `genreIds`. `genreIds` now filters out `0` (invalid per Apple). Improves readability. Added unit tests for `safeParseInt` and lookup/cleanApp parsing.
  - See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) §12.
- **suggest():** Rename map callback parameter from `term` to `s` to avoid shadowing destructured `term` from options.
- **app():** Use spread to build result instead of mutating `appData` after construction. Clearer data flow for screenshots and histogram.
- **appPageDetails():** Use `RequestOptions` from `types/options.ts` instead of inline type for `requestOptions`.
- **404 handling:** `privacy()` and `versionHistory()` now return empty `{}` and `[]` when the app page returns 404 (app not found), matching `similar()` and the screenshot/ratings parts of `app()`. Callers no longer get different behavior for the same nonexistent app.
- **App page URL:** Extracted shared `appPageUrl(country, appId)` in `common.ts`; `app`, `similar`, `privacy`, and `versionHistory` now use it instead of duplicating the URL template.
- `cleanApp` and related defaults now use `??` instead of `||` for null/undefined-only fallbacks; `ensureArray` uses a single expression; validation order is consistent (required params first, then `validateCountry`, then other validations) in `privacy()` and `versionHistory()`.
- **Request/doRequest():** Default timeout 30s → 15s. All requests use `AbortSignal.timeout(timeoutMs)`; retries opt-in (`retries: 0`); error message includes request URL. See `RequestOptions` (exported).
  - See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) §2 for error-handling migration.
- **Error handling:** Standardized on `HttpError`; use `instanceof HttpError && err.status === 404` (or 204) instead of message parsing.
- **Vitest:** `globals: false`; explicit imports only. Removed `console.warn` when search `page * num > 200`.
- **Screenshots:** Preserve original format (webp/jpg/png); use `Set` for URL deduplication. **list.ts:** Redundant type annotation removed (inferred from schema).
- **list() return type and behavior:** Overloaded signatures so return type narrows by `fullDetail`: `list(options & { fullDetail: true })` returns `Promise<App[]>`, otherwise `Promise<ListApp[]>`. When `fullDetail` is false (default), list is built only from RSS (one request); when true, full app details fetched via lookup. In v2, `fullDetail` was a no-op; v3 makes it meaningful — use `fullDetail: true` if you need full detail from `list()`.
  - See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) §1.
- **Type changes (breaking):** ListApp.developerId → `number` (developerIdNum removed). App.size → `number` (bytes). Genre IDs → `number[]`/`number`. App.contentRating → `''` when unknown.
  - See [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) §6–9.
- **RequestOptions:** Documented and exported.
- **CI:** `npm run test:coverage` after unit tests; optional integration job. Vitest 4.0.18.

### Dependencies

- **cheerio** ^1.2.0 — HTML parsing for privacy, similar, versionHistory, screenshots. Major upgrade from 0.x; API changes may affect consumers who extend or re-export cheerio types.
- **fast-xml-parser** ^5.5.3 — RSS and iTunes XML parsing. v5 has stricter parsing; see package changelog for migration.
- **zod** ^4.1.12 — Schema validation for iTunes and RSS responses. **Breaking:** Zod 4 replaces `.passthrough()` with `z.looseObject()`; error APIs and type inference changed. Internal schemas migrated; consumers using Zod for validation should upgrade to Zod 4. See [Zod v4 migration](https://zod.dev/v4/changelog).
- **vitest** ^4.1.0 — Test runner. Major upgrade; `globals: false` and explicit imports used. `pool: 'forks'` set to avoid watch-mode hangs.
- **eslint** ^10.0.3 — Flat config (eslint.config.js). Major upgrade from 8.x/9.x.
- **typescript** ^5.3.2 — TypeScript 5.x; DOM lib removed from tsconfig (Node-only).
- **tsup** ^8.0.1 — Build tool. Major upgrade.
- **@typescript-eslint/\*** ^8.57.0, **typescript-eslint** ^8.57.0 — ESLint TypeScript support.
- **@vitest/coverage-v8** ^4.1.0 — Coverage (matches vitest 4).
- **prettier** ^3.1.0, **eslint-config-prettier** ^10.1.8, **tsx** ^4.20.6, **@types/node** ^20.10.0 — Dev tooling.

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

[Unreleased]: https://github.com/davidshq-contribute/app-store-scraper-ts/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/davidshq-contribute/app-store-scraper-ts/compare/v2.0.1...v3.0.0
[2.0.1]: https://github.com/davidshq-contribute/app-store-scraper-ts/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/davidshq-contribute/app-store-scraper-ts/compare/v1.0.3...v2.0.0
[1.0.3]: https://github.com/davidshq-contribute/app-store-scraper-ts/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/davidshq-contribute/app-store-scraper-ts/compare/v1.0.1...v1.0.2
