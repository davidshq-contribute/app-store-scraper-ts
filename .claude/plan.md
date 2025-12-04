# Plan: Remove Unused Dependencies and Fix Repository URLs

## Problem Analysis

After exploring the codebase, I found:

**Dependencies Status:**
- ✅ `cheerio` - USED in [src/lib/ratings.ts](src/lib/ratings.ts) and [src/lib/similar.ts](src/lib/similar.ts)
- ✅ `fast-xml-parser` - USED in [src/lib/suggest.ts](src/lib/suggest.ts)
- ✅ `zod` - USED in [src/lib/schemas.ts](src/lib/schemas.ts)
- ❌ `p-memoize` - NOT USED anywhere
- ❌ `p-throttle` - NOT USED anywhere
- ❌ `undici` - NOT USED (code uses native `fetch` API in [src/lib/common.ts:19](src/lib/common.ts:19))

**Additional Issues Found:**
- Repository URLs in package.json point to `app-store-scraper` instead of `app-store-scraper-ts`
- IMPLEMENTATION.md file should be removed per user request

## Implementation Steps

### 1. Checkout main and create new branch
```bash
git checkout main
git pull
git checkout -b cleanup-unused-deps
```

### 2. Update package.json
Remove unused dependencies:
- Remove `p-memoize` from dependencies
- Remove `p-throttle` from dependencies
- Remove `undici` from dependencies

Fix repository URLs:
- Change `repository.url` from `app-store-scraper` to `app-store-scraper-ts`
- Change `bugs.url` from `app-store-scraper` to `app-store-scraper-ts`
- Change `homepage` from `app-store-scraper` to `app-store-scraper-ts`

Bump version:
- Change version from `1.0.3` to `1.0.4` (patch version for bug fix)

### 3. Delete IMPLEMENTATION.md
```bash
git rm IMPLEMENTATION.md
```

### 4. Update README.md title
Change the title from `# app-store-scraper-ts` to `# @perttu/app-store-scraper` to match the actual package name

### 5. Run npm install
Clean up package-lock.json to remove unused dependencies:
```bash
npm install
```

### 6. Verify build still works
```bash
npm run build
npm run typecheck
```

### 7. Commit changes (without Co-Authored-By)
```bash
git add .
git commit -m "Remove unused dependencies and fix repository URLs

- Remove unused dependencies: p-memoize, p-throttle, undici
- Fix repository URLs to point to correct repo (app-store-scraper-ts)
- Update README title to match package name
- Remove IMPLEMENTATION.md file
- Bump version to 1.0.4"
```

### 8. Push branch
```bash
git push -u origin cleanup-unused-deps
```

## Expected Results

- Smaller package size (fewer dependencies)
- Correct GitHub repository links in npm package page
- Clean codebase without implementation notes
- Version 1.0.4 ready to publish
- GitHub packages sidebar will properly link once new version is published

## Verification

After merging and publishing:
1. Check npm package page shows correct repository link
2. Verify GitHub packages sidebar displays the package
3. Test that the package still works: `npm install @perttu/app-store-scraper`
4. Run example: `npm run example`
