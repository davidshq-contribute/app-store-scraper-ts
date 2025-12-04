# Adding Rate Limiting and Memoization to @perttu/app-store-scraper

This guide shows you how to add rate limiting and memoization to your App Store scraper implementation using popular npm packages.

## Why Add These Features?

**Rate Limiting (Throttling):**
- Prevents hitting API rate limits
- Avoids overwhelming the iTunes API servers
- Makes your scraper more respectful and reliable
- [TODO: Add your own context about when you'd want this]

**Memoization (Caching):**
- Speeds up repeated queries
- Reduces API calls for the same data
- Saves bandwidth and improves performance
- [TODO: Add your own context about when caching makes sense]

## Prerequisites

```bash
npm install p-memoize p-throttle
```

## Approach 1: Simple Wrapper Functions

### Step 1: Create a Utilities File

Create a file `utils/scraper-utils.ts` (or `.js` if not using TypeScript):

```typescript
import pMemoize from 'p-memoize';
import pThrottle from 'p-throttle';

// [TODO: Add explanation of what this memoize function does]
export function memoize<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: { maxAge?: number; cacheSize?: number }
): T {
  return pMemoize(fn, {
    maxAge: options?.maxAge ?? 300000, // Default: 5 minutes
    cacheKey: (args) => JSON.stringify(args[0]), // Cache by the options object
  }) as T;
}

// [TODO: Add explanation of what this throttle function does]
export function throttle<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: { limit: number; interval: number }
): T {
  const throttled = pThrottle({
    limit: options.limit,     // Max calls
    interval: options.interval, // Per interval (ms)
  });
  return throttled(fn) as T;
}
```

### Step 2: Use With Your Scraper

```typescript
import { app, search } from '@perttu/app-store-scraper';
import { memoize, throttle } from './utils/scraper-utils';

// [TODO: Add example of when you'd want memoization]
// Example: Cache app details for 10 minutes
const cachedApp = memoize(app, { maxAge: 600000 });

// [TODO: Add example of when you'd want throttling]
// Example: Limit to 10 requests per second
const throttledSearch = throttle(search, {
  limit: 10,
  interval: 1000
});

// Usage
const appData = await cachedApp({ id: 553834731 });
const results = await throttledSearch({ term: 'minecraft' });
```

## Approach 2: Combining Both Features

[TODO: Write section about combining memoization and throttling]

```typescript
import { app } from '@perttu/app-store-scraper';
import { memoize, throttle } from './utils/scraper-utils';

// Apply both: cache results AND limit rate
const optimizedApp = throttle(
  memoize(app, { maxAge: 300000 }),
  { limit: 5, interval: 1000 }
);

// [TODO: Add explanation of the order and why it matters]
```

## Approach 3: Creating a Wrapper Class

[TODO: Write section about creating a class-based wrapper that handles all scraper methods]

```typescript
class AppStoreScraper {
  // [TODO: Implement class-based approach]
}
```

## Configuration Strategies

### Strategy 1: Per-Function Configuration

[TODO: Show how to configure different rates for different functions]

```typescript
// Example structure:
const throttledApp = throttle(app, { limit: 10, interval: 1000 });
const throttledSearch = throttle(search, { limit: 5, interval: 1000 });
```

### Strategy 2: Global Configuration

[TODO: Show how to set up global rate limiting across all API calls]

## Best Practices

[TODO: Add your recommendations for:]

### When to Use Memoization
- [ ] What types of queries benefit from caching?
- [ ] How long should cache TTL be?
- [ ] When should you invalidate cache?

### When to Use Rate Limiting
- [ ] What are reasonable rate limits?
- [ ] How to handle rate limit errors?
- [ ] Backoff strategies?

### Combining Both
- [ ] Order of operations (memoize first or throttle first)?
- [ ] Memory considerations?
- [ ] Performance tradeoffs?

## Common Patterns

### Pattern 1: Bulk Scraping

[TODO: Show how to scrape multiple apps efficiently]

```typescript
async function scrapeMultipleApps(ids: number[]) {
  // [TODO: Implement with rate limiting]
}
```

### Pattern 2: Real-time Updates

[TODO: Show how to use short cache TTLs for near-real-time data]

### Pattern 3: Background Jobs

[TODO: Show how to configure for background scraping jobs]

## Troubleshooting

### Cache Not Working
[TODO: Add debugging tips for cache misses]

### Rate Limiting Too Aggressive
[TODO: How to tune rate limits]

### Memory Usage
[TODO: How to manage cache size]

## Advanced Topics

### Custom Cache Keys
[TODO: Show how to customize caching logic]

### Persistent Caching
[TODO: How to use Redis or file-based caching instead of in-memory]

### Distributed Rate Limiting
[TODO: How to coordinate rate limits across multiple processes/servers]

## Example: Complete Implementation

[TODO: Provide a complete, real-world example]

```typescript
// complete-example.ts
// [TODO: Full working example with both features]
```

## Further Reading

- [p-memoize documentation](https://github.com/sindresorhus/p-memoize)
- [p-throttle documentation](https://github.com/sindresorhus/p-throttle)
- [TODO: Add your own recommended resources]
