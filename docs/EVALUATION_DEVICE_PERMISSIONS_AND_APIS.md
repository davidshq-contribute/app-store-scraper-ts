# Evaluation: Device Permissions, Rating Histogram, and MZStore

This document evaluates opportunities to enhance the app-store-scraper library: device permissions parsing, rating histogram robustness via aria-labels, and a comparison of the public iTunes API vs MZStore.

**Last verified:** March 2026

---

## 1. Device Permissions

### What Are Device Permissions vs Privacy Labels?

| Concept | Description | Where on App Page |
|---------|-------------|-------------------|
| **Privacy labels** | Data collection categories (what data the app collects and how it's used) | App Privacy section — "Data Linked to You", "Data Used to Track You", "Data Not Linked to You" |
| **Device permissions** | Runtime permissions the app may request (Camera, Microphone, Location, Photos, etc.) | Information section and/or app description |

The library's `privacy()` and `appPageDetails()` return **privacy labels** only — data types (e.g. Location, Contact Info, User Content) and purposes. They do **not** return device permissions.

### What Is Available on the App Page?

| Permission type | On page? | Location | Example |
|-----------------|----------|----------|---------|
| **Location** (background) | Yes | Information section | "This app may use your location even when it isn't open, which can decrease device battery life." |
| **Optional permissions** | Yes | In app description text | "Minecraft may request the following optional permissions: Local Network, App Tracking" |
| **Camera** | No | — | Not shown as a separate permission row |
| **Microphone** | No | — | Not shown as a separate permission row |
| **Photos** | No | — | Not shown as a separate permission row |

### Privacy Labels vs Device Permissions

Privacy labels include **data categories** such as Location, User Content, Contact Info. These indicate what data the app *collects*, not necessarily which permissions it *requests*. For example:

- An app that collects "Location" in its privacy label may request the Location permission.
- "User Content" can imply Photos/Camera access but is not a direct permission declaration.
- Camera and Microphone are not explicitly listed as permission rows on the web app page.

### Recommendation

1. **Location** — Can be parsed from the Information section when present. Add a `devicePermissions` or `locationUsage` field to `AppPageDetailsResult` (or a new `appPageDetails` extension) that captures: `{ usesBackgroundLocation?: boolean }` when the "This app may use your location even when it isn't open" text is present.

2. **Optional permissions** — Appear in the description as free text (e.g. "Local Network", "App Tracking"). Parsing would require regex or NLP over the description; fragile and app-specific. Low priority.

3. **Camera, Microphone, Photos** — Not exposed as discrete permission rows on the web page. The only proxy is privacy label data categories (e.g. "User Content" for photos). No reliable way to extract these without Apple adding them to the page.

4. **Schema** — If adding device permissions, extend `PrivacyDetails` or add `AppPageDetailsResult.devicePermissions?: { usesBackgroundLocation?: boolean; optionalPermissions?: string[] }` so consumers can store and display this.

---

## 2. Rating Histogram: Using aria-labels

### Current Behavior

The `ratings()` parser in `src/lib/ratings.ts` assumes `.vote .total` elements are in **descending order** (5★, 4★, 3★, 2★, 1★). It maps `index` to `starRating = 5 - index`. If Apple reverses the order, the histogram would silently invert.

### Labels Are Available

The iTunes customer-reviews page (`itunes.apple.com/{country}/customer-reviews/id{id}?displayable-kind=11`) includes `aria-label` on each `.vote` div:

```html
<div class="vote" role="text" aria-label='5 stars, 634,418 ratings'>
  ...
  <span class="total">634418</span>
</div>
<div class="vote" role="text" aria-label='4 stars, 62,837 ratings'>
  ...
</div>
...
<div class="vote" role="text" aria-label='1 star, 56,606 ratings'>
  ...
</div>
```

Format: `aria-label='N stars, X ratings'` (or `'1 star, X ratings'` for single star).

### Changes Required

1. **Parse `aria-label`** — For each `.vote` element, read `$(el).attr('aria-label')` and extract the star count via regex: `/(\d+)\s+stars?/` (handles both "5 stars" and "1 star").

2. **Map count to star rating** — Use the parsed star value (1–5) as the histogram key instead of `5 - index`.

3. **Fallback** — If `aria-label` is missing or unparseable, fall back to the current index-based logic and add a `warnings` entry so consumers are aware.

4. **Unit tests** — Add fixtures with `aria-label` present and with `aria-label` absent to ensure both paths work.

### Example Implementation Sketch

```typescript
// In parseRatings(), replace the index-based mapping with:
$('.vote').each((_, el) => {
  const $el = $(el);
  const totalEl = $el.find('.total');
  if (totalEl.length === 0) return;
  const count = parseInt(totalEl.text(), 10);
  if (Number.isNaN(count)) return;

  const ariaLabel = $el.attr('aria-label') ?? '';
  const starMatch = ariaLabel.match(/(\d+)\s+stars?/i);
  const starRating = starMatch ? parseInt(starMatch[1], 10) : null;

  if (starRating >= 1 && starRating <= 5) {
    histogram[starRating as 1 | 2 | 3 | 4 | 5] = count;
  } else {
    // Fallback: assume order 5→1 by index
    // ... existing logic with warning
  }
});
```

### Files to Update

- `src/lib/ratings.ts` — `parseRatings()` function
- `src/__tests__/ratings.test.ts` — Add fixtures with `aria-label`, test fallback when missing
- `docs/POSTPONED.md` — Remove or resolve item 1.2 (Ratings Histogram Order Assumption)

---

## 3. MZStore vs Public iTunes API

### Overview

| Aspect | Public iTunes API | MZStore (WebObjects) |
|--------|-------------------|------------------------|
| **URL** | `https://itunes.apple.com/search` | `https://search.itunes.apple.com/WebObjects/MZStore.woa/wa/search` |
| **Documentation** | [Official Apple docs](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) | Undocumented, internal |
| **Headers** | None required (country via query param) | `X-Apple-Store-Front`, `Accept-Language` |
| **Stability** | Long-standing, documented surface | Can change without notice |

### Search: Results and Limits

| Feature | Public iTunes API | MZStore |
|---------|-------------------|---------|
| **Max results per request** | 200 (`limit` param) | ~230–250 (hard cap; `limit`/`num` params ignored) |
| **Pagination** | `limit` + `offset` via multiple requests | **No** — `offset`, `page`, `start`, `from` are ignored; same results returned |
| **Result order** | Same top results (verified: first 13 IDs match for "minecraft") | Same |
| **Total count** | `resultCount` in response | `bubbles[0].totalCount` |

**Summary:** MZStore returns ~230–250 results per request regardless of limit params. Offset-based pagination does not work — you cannot get 1000 results across four requests. Public iTunes API supports `offset` and caps at 200 per request.

### Data Exposed

| Data / Field | Public iTunes Search | MZStore Search |
|-------------|----------------------|----------------|
| App ID | Yes | Yes |
| Track/app name | Yes | Yes (in `storePlatformData`) |
| Artist/developer | Yes | Yes |
| Artwork URLs | Yes | Yes (multiple sizes) |
| Price, currency | Yes | Yes |
| Average rating, rating count | Yes | Yes |
| Screenshots | No (requires lookup) | Yes (`screenshotsByType`) |
| Device families | No | Yes (`deviceFamilies`) |
| Content rating by system | Basic | Yes (`contentRatingsBySystem`) |
| Minimum OS version | Yes | Yes |
| Genre names | Yes | Yes |
| Editorial video | No | Yes (`editorialVideo`) |
| User rating (per result) | Yes | Yes (`userRating`) |
| Bundle ID | No (lookup) | Yes |
| In-app purchases flag | Yes | Yes |
| Siri supported | No | Yes |
| Game controller supported | No | Yes |
| Messages extension | No | Yes |
| Preorder status | No | Yes |

**Bundle ID** is the unique reverse-DNS identifier (e.g. `com.company.appname`) that identifies an app across Apple's ecosystem; it differs from the numeric App ID used in URLs.

**Messages extension** indicates whether the app extends the iMessage app (e.g. sticker packs, in-conversation apps, interactive content).

### Response Structure

| Aspect | Public iTunes API | MZStore |
|--------|-------------------|---------|
| **Format** | JSON array `results` | JSON with `bubbles[0].results` (IDs) + `storePlatformData['native-search-lockup-search'].results` (full objects keyed by ID) |
| **Lookup needed** | Optional (search returns full objects for basic fields) | No — full app objects in search response |
| **Extra metadata** | Basic | Rich (screenshots, deviceFamilies, editorialVideo, etc.) |

### Caveats

- **MZStore vs native App Store** — GitHub issues (e.g. facundoolano/app-store-scraper#200, #30) report that MZStore search results can differ from what users see in the iOS App Store app, which uses a private API (`amp-api-search-edge.apps.apple.com`). Neither public iTunes nor MZStore is guaranteed to match the native app.
- **Undocumented** — MZStore structure can change without notice.
- **Headers** — MZStore requires `X-Apple-Store-Front` (storefront ID); wrong value may return empty or different results.

### Recommendation

- **Default** — Keep using the public iTunes Search API for `search()` (documented, stable).
- **Optional MZStore path** — Add `searchBackend: 'itunes' | 'mzstore'` only when there is a concrete need for richer search metadata (screenshots, deviceFamilies, etc.) or parity with the JS package. Document that MZStore is undocumented and may not match the native App Store.

---

## See Also

- [DEV-DECISIONS.md](DEV-DECISIONS.md) — Search API choice, app page consolidation
- [POSTPONED.md](POSTPONED.md) — Item 1.2 (ratings histogram order)
- [BREAKING-CHANGES.md](BREAKING-CHANGES.md) — v3 upgrade guide
