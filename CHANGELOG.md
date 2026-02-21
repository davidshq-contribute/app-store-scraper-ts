# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Search pagination now works correctly for page > 1 (request `page * num` results and slice client-side).
- TypeScript: resolve `URLSearchParams` by including DOM lib in `tsconfig.json`.
- TypeScript: add explicit types for search result callbacks (`ITunesAppResponse`) to satisfy `noImplicitAny`.

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
