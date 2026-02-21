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
