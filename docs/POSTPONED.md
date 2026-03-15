# Postponed Enhancements

Enhancements we’ve decided to defer. They may be revisited when we need parity with other implementations or store-specific behavior.

---

## Postponed Bugs

### ~~B1: `reviews()` `slice(1)` drops first entry~~ **FIXED**

**Context:** `reviews()` used `slice(1)` which dropped the first entry. Single-review feeds returned empty.

**Fix:** Replaced `slice(1)` with `entries.filter((entry) => entry.author != null)` to distinguish metadata entries (no `author`) from real reviews. Tests added for single-review, metadata-only, and empty feed cases.

---

## Suggest: store front and country

**Context:** The JS package sends `X-Apple-Store-Front: ${storeId},29` (and can use country) for the suggest endpoint; we do not send store-specific headers for `suggest()`.

**Idea:** Add optional `country` and `X-Apple-Store-Front` (e.g. via `storeId(country)`) to suggest requests for consistency and store/country-specific suggestions.

**Status:** Postponed.

## 2. Security & Robustness

### 2.1 [Low] URL Construction via Template Literals

**Files:** `src/lib/reviews.ts:51`, `src/lib/list.ts:119-123`, `src/lib/ratings.ts:33`
**Severity:** Low (mitigated by allowlist validation)

Several URLs are built via template literals:

```typescript
const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${id}/sortby=${sort}/json`;
```

The allowlist validators (`validateCountry`, `validateSort`, etc.) run before URL construction, which prevents injection. This is good. However, the pattern is fragile — a new endpoint that skips validation could introduce path injection.

**Recommendation:** Consider a helper like `buildItunesUrl(template, params)` that validates all interpolated values against allowlists in a single place, making it impossible to forget.

---

## 3. Architecture & Design

### 3.1 [Low] `list()` fullDetail Fetches All IDs in a Single Lookup

**File:** `src/lib/list.ts:164`
**Severity:** Low

```typescript
return lookup(ids, 'id', country, lang, requestOptions);
```

With `num: 200`, this sends a single request with 200 comma-separated IDs. The iTunes API may truncate or timeout on very large batches.

**Recommendation:** Consider chunking into batches of 50-100 IDs and merging results. This also opens the door for parallel lookups.

---

## 4. Test Coverage Gaps

### 4.1 [Low] HTML Scraping Tests Rely on Static Fixtures

**Severity:** Low (by design)

The fixture-based approach is correct for unit tests, but doesn't catch Apple changing their DOM structure.

**Recommendation:** The weekly CI workflow (`weekly-tests.yml`) should include integration tests for `similar()`, `privacy()`, and `versionHistory()` that hit the live App Store and validate the result shape (not specific values). This provides early warning of DOM changes.

---

## 5. Performance Opportunities

### 5.1 [Low] No Connection Pooling or Keep-Alive Hint

**File:** `src/lib/common.ts:65`
**Severity:** Low

Node's native `fetch` uses the global dispatcher. For batch operations (e.g., fetching 100 apps), explicit connection pooling via `undici.Agent` could improve throughput. This is an advanced optimization and not urgent.