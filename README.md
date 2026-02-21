# @perttu/app-store-scraper

Modern TypeScript library to scrape application data from the iTunes/Mac App Store.

This is a complete TypeScript rewrite of [facundoolano/app-store-scraper](https://github.com/facundoolano/app-store-scraper) with full type safety and modern dependencies.

## Features

- 🎯 **Full TypeScript support** with comprehensive type definitions
- 🔄 **Modern dependencies** (no deprecated packages)
- 📦 **Dual ESM/CJS support** for maximum compatibility
- 🌍 **Multi-region support** with 140+ country codes
- 🎨 **Named ESM exports** — bundlers can tree-shake when configured; single-bundle output may limit effectiveness

> **Want rate limiting or memoization?** See this blog post: [Throttling and memoizing App Store scraper calls](https://perttu.dev/articles/throttling-and-memoing-app-store-scraping)

## Installation

**Requirements:** Node.js ≥20.

```bash
npm install @perttu/app-store-scraper
```

**Upgrading from v2.x?** v3 is a major release. The main change: `list()` now returns `ListApp[]` by default (one RSS request). To keep the previous behavior (full `App[]`), use `list({ fullDetail: true })`:

```typescript
// v2.x: list() returned App[]
const apps: App[] = await list();

// v3.x: request full detail explicitly (same shape and behavior)
const apps: App[] = await list({ fullDetail: true });
```

One-line change: add `{ fullDetail: true }` (or merge into your existing options). If you don't need `genres`, `screenshots`, `score`, `reviews`, `version`, etc., keep using `list()` as-is and use the `ListApp` type. For all breaking changes, see [docs/BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md).

## Usage

```typescript
import { app, search, list, reviews, collection, category } from '@perttu/app-store-scraper';

// Get app details
const appData = await app({ id: 553834731 });

// Search for apps
const results = await search({ term: 'minecraft', num: 10 });

// Get top free games (light shape by default; use fullDetail: true for full app details)
const games = await list({
  collection: collection.TOP_FREE_IOS,
  category: category.GAMES,
  num: 50,
});

// Get reviews
const appReviews = await reviews({ id: 553834731, page: 1 });
```

**📖 See [examples/all-methods.ts](examples/all-methods.ts) for comprehensive examples of all 11 API methods.**

## API

### Methods

- `app()` - Get detailed app information
- `resolveAppId()` - Resolve bundle ID to numeric track ID (single lookup; use instead of `app()` when you only need the id)
- `list()` - Get curated app lists (returns light `ListApp[]` by default; `fullDetail: true` for full `App[]`)
- `search()` - Search for apps by keyword (optional `device` to filter by iPad/Mac/all; pagination limited to first 200 results; see JSDoc)
- `developer()` - Get all apps from a developer
- `reviews()` - Get user reviews for an app
- `ratings()` - Get rating distribution histogram
- `similar()` - Get similar/related apps (returns `App[]` by default; pass `includeLinkType: true` for `SimilarApp[]` with `app` and `linkType`, e.g. `customers-also-bought`, `more-by-developer`)
- `suggest()` - Get search suggestions
- `privacy()` - Get privacy policy details
- `versionHistory()` - Get version release history

**Note:** `privacy()` and `versionHistory()` scrape Apple’s app page HTML and depend on its DOM structure; they may break if Apple changes the page. See `docs/DEV-DECISIONS.md` for details.

### Constants

- `collection` - App Store collections (TOP_FREE_IOS, etc.)
- `category` - App categories (GAMES, BUSINESS, etc.)
- `sort` - Sort options for reviews (RECENT, HELPFUL)
- `device` - Device types (IPAD, MAC, ALL)

Only supported values are accepted for `country`, `collection`, `category`, `device`, and `sort`. Invalid values throw a clear error (e.g. `Invalid country: "xx"`) instead of being sent to the API. Use the exported `collection`, `category`, `device`, and `sort` constants and the `markets` object (for valid country codes).

**Country/market validation:** The library uses a static allowlist of supported country codes (`markets`). An invalid or unknown country code throws; there is no fallback to a default. This keeps behavior predictable and avoids URL injection. If Apple adds a new storefront, you will need a patch release of this library that includes the new market in the allowlist; such updates are published when new markets appear.

### Request options

Most methods accept a `requestOptions` object (see `RequestOptions` in the types). **Supported:** `headers` (custom headers merged with defaults), `timeoutMs` (request timeout in ms; default 15000), `retries` (number of retries for 429/503/network/timeout errors with exponential backoff; default 0 — opt-in; set e.g. 2 to enable). With retries enabled, total wait on repeated timeouts can be up to `timeoutMs * (1 + retries)` plus backoff. Each request is independent: other concurrent calls (e.g. other crawls) are not blocked.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run example (exercises all methods against the live API)
npm run example

# Run unit tests (single run; exits for CI/scripts)
npm run test

# Run unit tests in watch mode (local development)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run integration tests (live API; skipped by default)
RUN_INTEGRATION_TESTS=1 npm run test

# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format
```

## Documentation

- [BREAKING-CHANGES.md](docs/BREAKING-CHANGES.md) – Upgrade guide and breaking changes (e.g. v2 → v3).
- [DEV-DECISIONS.md](docs/DEV-DECISIONS.md) – Design decisions (APIs vs scraping, DOM-dependent methods, etc.).
- [POSTPONED.md](docs/POSTPONED.md) – Deferred enhancements and known limitations.
- [CHANGELOG.md](CHANGELOG.md) – Release history.

## License

MIT
