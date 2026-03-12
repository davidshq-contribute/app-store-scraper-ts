# Postponed Enhancements

Enhancements we’ve decided to defer. They may be revisited when we need parity with other implementations or store-specific behavior.

---

## Postponed Bugs

### B1: `reviews()` `slice(1)` drops first entry

**Context:** `reviews()` uses `slice(1)` somewhere in its flow, which drops the first entry. Single-review feeds therefore return empty.

**Impact:** P0, Medium–High. Affects any app with only one review.

**Status:** Won't fix now.

---

## Suggest: store front and country

**Context:** The JS package sends `X-Apple-Store-Front: ${storeId},29` (and can use country) for the suggest endpoint; we do not send store-specific headers for `suggest()`.

**Idea:** Add optional `country` and `X-Apple-Store-Front` (e.g. via `storeId(country)`) to suggest requests for consistency and store/country-specific suggestions.

**Status:** Postponed.

## 1. Bugs & Correctness Issues

---

### 1.2 [Low] Ratings Histogram Order Assumption

**File:** `src/lib/ratings.ts:67-78`
**Severity:** Low (defended by sanity check, but silent on order flip)

The histogram parser assumes `.vote .total` elements are in descending order (5-star first). If Apple reverses the order, the histogram silently inverts (5-star count assigned to 1-star, etc.) because there's no per-row label check.

**Recommendation:** Parse the star label from each row's sibling/parent element (e.g., aria-label, adjacent text) rather than relying on DOM order. If labels aren't available, log a warning when more than one ordering interpretation produces a valid histogram.

---

## 2. Security & Robustness

### 2.1 [Low] Hardcoded User-Agent May Trigger Bot Detection

**File:** `src/lib/common.ts:47`
**Severity:** Low

The `User-Agent` string (`Chrome/120.0.0.0`) will age and may eventually be flagged by Apple's CDN. Users can override via `requestOptions.headers`, but the default should be periodically updated.

**Recommendation:** Either document that users should pass their own `User-Agent`, or bump the Chrome version in a maintenance release cycle. Consider making the default `User-Agent` a named export so consumers can inspect/override it.

---

### 2.2 [Low] URL Construction via Template Literals

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