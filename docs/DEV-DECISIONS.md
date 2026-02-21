# Development decisions

Record of non-obvious design and implementation choices so future changes stay consistent.

---

## Privacy and version history: API vs HTML scraping

**Decision:** Use Cheerio to scrape the app page HTML for `privacy()` and `versionHistory()`. Do not use the amp-api-edge catalog API for these endpoints until token extraction works again.

**Context:**

- We originally used the amp-api-edge flow: fetch app page → extract bearer token from HTML → call  
  `https://amp-api-edge.apps.apple.com/v1/catalog/{country}/apps/{id}?platform=web&fields=privacyDetails`  
  (or `extend=versionHistory`) with `Authorization: Bearer {token}`. Data came from structured JSON.
- Apple changed the app store page so the token is no longer embedded in the HTML (or not in the same form). Token extraction broke; we switched to Cheerio as a working fallback (commits b74c8bf, af76c23). The API itself is not deprecated.
- Our current approach: scrape the same app page with Cheerio. Version history uses structural selectors (`dialog[data-testid="dialog"] article`, `article > h4`, `article > p`, `time`); no Svelte class hashes. Privacy still uses a mix of `data-testid` and class-based selectors. Both remain sensitive to DOM structure changes.
- Using the API again would be more stable than relying on specific CSS classes, but `scripts/check-amp-api-token.mjs` showed the token was not found (or the API did not accept it).

**Implications:**

- Keep the HTML scraping method for `privacy()` and `versionHistory()`.
- If Apple restores the token in the page later, run `scripts/check-amp-api-token.mjs` again; if it succeeds, consider switching back to the API.
- When touching privacy/version-history code, prefer selectors that are less likely to change (e.g. `data-testid` over Svelte hashes) and document any assumptions.
- **These methods rely on Apple’s DOM** (see CODE-REVIEW.md FRAGILE-1, FRAGILE-2). They may break when Apple changes the app page structure or class names. Do not add automated tests for `privacy` or `version-history` until selectors are stabilized; otherwise tests will be flaky.
- **If `versionHistory()` returns wrong or empty data:** (1) Scope to version-history-shaped articles only—e.g. only push entries when the article has a child `time[datetime]` (and optionally `h4`) so we don’t pull in articles from other dialogs that use `data-testid="dialog"`. (2) If Apple adds wrapper elements (e.g. `article > div > h4`), relax the direct-child selectors to `article h4` / `article p` (first match) so we still get version and release notes.

---

## Search: public iTunes API vs MZStore/WebObjects

**Decision:** Use the public iTunes Search API (`https://itunes.apple.com/search`) for `search()`. Do not use the WebObjects/MZStore search endpoint or `X-Apple-Store-Front` unless parity with app-store-scraper-js or store-specific results is required.

**Context:**

- The original JS package (app-store-scraper-js) uses the WebObjects search endpoint  
  `https://search.itunes.apple.com/WebObjects/MZStore.woa/wa/search?clientApplication=Software&media=software&term=...`  
  with headers `X-Apple-Store-Front` and `Accept-Language`, then optionally calls `lookup` for full app details.
- We use the public API with query params (`term`, `country`, `media=software`, `entity=software`, `limit`); no store-front header. Simpler to implement and maintain; the public API is a long-standing, documented surface. Internal WebObjects endpoints can change without notice.
- Different backends can yield different result sets or ranking. If you need the same results as the JS package or store-specific behavior, we’d need to add the MZStore search path and store-front handling.

**Implications:**

- Keep using the public iTunes Search API for `search()` by default.
- Add MZStore-based search (and optional `idsOnly` + lookup) only when there is a concrete need for JS parity or store-specific results. See `docs/COMPARISON-WITH-APP-STORE-SCRAPER-JS.md` for details.

---

## v3.0.0: Changes we decided not to make

Decisions recorded during the v3.0.0 breaking-changes plan. Kept here so we don’t revisit the same churn later.

### Type-level enforcement for `id | appId` required options

**Decision:** Do not use a discriminated union so that at least one of `id` or `appId` is required at compile time. Keep runtime validation via `validateRequiredField()`.

**Context:** `AppOptions`, `ReviewsOptions`, `SimilarOptions` have both `id?: number` and `appId?: string` optional. Discriminated unions on optional properties don’t work cleanly in TypeScript; callers who conditionally set fields get friction, and `{ id: 123, appId: 'com.foo' }` would satisfy both branches. Runtime validation is clear and error messages are good.

**Implications:** Rely on runtime validation. Do not add type-level “at least one of” enforcement.

---

### `score` sentinel: keep `0`, don’t change to `null`

**Decision:** Keep using `0` as the sentinel for “no rating data”. Do not change to `number | null`.

**Context:** `null` would be more semantically correct for “no data”, but: TypeScript makes `number | null` fields annoying (every arithmetic operation needs a null check); `0` is documented and tested; Apple doesn’t support 0-star ratings, so there’s no ambiguity in practice; changing the type breaks every consumer.

**Implications:** Keep `score` as `number` with `0` meaning no data.

---

### `score` vs `currentVersionScore` — semantics and JSDoc

**Decision:** `App.score` = average rating for **all versions**; `App.currentVersionScore` = average rating for **current version**. JSDoc in `src/types/app.ts` must match `cleanApp()` in `src/lib/common.ts` (which maps `averageUserRating` → `score`, `averageUserRatingForCurrentVersion` → `currentVersionScore`).

**Context:** The TypeScript rewrite once had reversed JSDoc (docs said score = current, currentVersionScore = all). The **implementation** was always correct. The original [facundoolano/app-store-scraper](https://github.com/facundoolano/app-store-scraper) (JavaScript) uses the same correct mapping in `lib/common.js` `cleanApp`; it did not have this documentation bug.

**Implications:** Keep JSDoc aligned with implementation. Release notes (e.g. CHANGELOG, BREAKING-CHANGES) should mention the correction so anyone who coded against the old descriptions is aware.

---

### Don’t split `search()` into `search()` + `searchIds()`

**Decision:** Do not add a separate `searchIds()` function. Keep a single `search()` with overloads for `idsOnly`.

**Context:** Splitting would be cleaner but breaks all existing `search({ idsOnly: true })` callers. Overloads give the same type safety without breaking the API surface.

**Implications:** Use overloads for `idsOnly`; do not introduce `searchIds()`.

---

### Don’t change `Ratings.ratings` field name

**Decision:** Keep the field name `ratings` on the `Ratings` type. Do not rename to `totalCount` or `count`.

**Context:** The name is redundant/confusing on a type called `Ratings`, but renaming is a breaking change for a cosmetic improvement.

**Implications:** Keep as-is.

---

### Don’t change date fields to `Date` objects

**Decision:** Keep `released`, `updated`, `releaseDate` as strings. Do not return `Date` objects.

**Context:** `Date` objects would be richer but: JSON serialization turns them back into strings; consumers may want ISO strings, not Date objects; parsing date strings can introduce timezone issues.

**Implications:** Strings are the safe choice for a data-fetching library. Keep date fields as strings.

---

### Don’t rename `App.reviews` to `App.ratingsCount`

**Decision:** Keep the property name `reviews` on `App`. Do not rename to `ratingsCount`.

**Context:** `reviews` is misleading — it’s the count of ratings, not the count of text reviews. Renaming would break every consumer.

**Implications:** Keep as-is. Document in types/JSDoc that it means the count of ratings.

---

## npm lifecycle: keep `prepare` for GitHub-URL installs

**Decision:** Keep the `prepare` script in `package.json`. Do not remove it in favour of `prepublishOnly` only.

**Context:** The package is consumed as a dependency from the GitHub URL (not only from npm). `main`/`exports` point to `./dist/`, and `dist/` is gitignored, so there are no built artifacts in the repo. Installing from GitHub therefore requires a post-install build; `prepublishOnly` does not run in that case. Removing `prepare` would break GitHub-URL installs unless we committed `dist/` (undesirable).

**Implications:** Trade-off: install can fail if the build fails, but the package would not work without this hook for Git-based installs. Keep `prepare`.
