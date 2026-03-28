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

### Content rating: iTunes vs MZStore

| Source | Field | What you get |
|--------|--------|----------------|
| **Public iTunes** (Lookup only; Search does not return rating) | `contentAdvisoryRating` | A **single string** for the storefront (e.g. `"4+"`, `"12+"`, `"17+"`). One value per app; no breakdown by region or rating system. |
| **MZStore** | `contentRatingsBySystem` | **Per-system ratings**: e.g. US (ESRB-style), EU (PEGI), etc. Useful when you need region-specific or multi-system labels (e.g. "4+" in one region, "12+" in another) without multiple lookups. |

So: iTunes gives one advisory string per app from lookup; MZStore can give a map of rating system → value in the same search response.

### Device families: what they are and where we get them

**Device families** are the **platforms the app supports**: iPhone, iPad, Apple TV, etc. (Sometimes represented as numeric family IDs in internal APIs, e.g. 1 = iPhone, 2 = iPad.)

- **Public iTunes**  
  - **Search:** Does **not** return device families.  
  - **Lookup:** Returns `supportedDevices` — an array of device name strings (e.g. `["iPhone", "iPad"]`). The same app also returns screenshot URLs **already grouped by device type**: `screenshotUrls` (iPhone/iPod), `ipadScreenshotUrls`, `appletvScreenshotUrls`. So we do get “devices” from public iTunes via **lookup**: a flat list of supported device names plus screenshots batched by iPhone / iPad / Apple TV.  
- **MZStore**  
  - **Search:** Returns `deviceFamilies` in the search response, so you get supported device types without a per-app lookup.

So the difference is not “iTunes shows all devices vs MZStore batches by iPad/iOS” — both can express the same idea (iPhone, iPad, Apple TV). The difference is **where**: iTunes only exposes it on **lookup**; MZStore exposes it in **search**, so you avoid N extra lookups for N results.

### Screenshots: request and time impact

- **Public iTunes:** Search returns **no** screenshots. To get screenshots you must call **lookup** (or `app()`) per app. So for **N** search results, getting screenshots = **1 search + N lookups** (N+1 HTTP requests).
- **MZStore:** Search response includes `screenshotsByType` per result. One search request can give you screenshots for all results in that response.

**Time impact:** Using MZStore for search when you need screenshots **removes N round-trips** (one per app). For 100 apps that’s 100 fewer requests; for 200 apps, 200 fewer. Exact time saved depends on latency and rate limiting; the main gain is fewer requests and less risk of rate limits rather than a fixed “X seconds faster” number.

### Glossary: editorial video, messages extension

- **Editorial video** — A **promotional or “hero” video** shown on the app’s store page (often at the top). It can be chosen by Apple as “editorial” content or provided by the developer. MZStore exposes metadata for it (`editorialVideo`); public iTunes does not.
- **Messages extension** — Indicates the app **extends iMessage**: e.g. sticker packs, in-conversation mini-apps, or other content that appears inside the Messages app. MZStore exposes this flag; public iTunes does not.

**Bundle ID** is the unique reverse-DNS identifier (e.g. `com.company.appname`) that identifies an app across Apple's ecosystem; it differs from the numeric App ID used in URLs.

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
