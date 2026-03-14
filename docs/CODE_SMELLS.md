# Code Smells Review: app-store-scraper

A review of the app-store-scraper codebase for code smells—patterns that suggest technical debt, maintainability issues, or refactoring opportunities. Not all items require immediate change; treat this as an inventory to address incrementally.

**Importance scale (pragmatic):** High = fix when touching that code or soon; affects correctness or caller experience. Medium = worth doing when refactoring that area. Low = nice-to-have; do if trivial. Defer = YAGNI; only if more call sites appear or already in file.

---

## 2. Options cast to `Record<string, unknown>` for validation

**Severity: Low** · **Importance: Low**

### Locations

- **`src/lib/app.ts`** (line ~155): `validateRequiredField(options as Record<string, unknown>, ['id', 'appId'], ...)`
- **`src/lib/reviews.ts`** (line ~44): same pattern for `['id', 'appId']`
- **`src/lib/similar.ts`** (line ~43): same pattern for `['id', 'appId']`

`validateRequiredField` is typed to accept `Record<string, unknown>`, so callers must cast typed options. The cast is safe but noisy and could be avoided if the helper accepted a generic or a union of option types that have at least one of the required keys.

### Recommendation

- Option A: Keep as-is; the cast is explicit and safe.
- Option B: Add an overload or generic, e.g. `validateRequiredField<T extends Record<string, unknown>>(options: T, fields: (keyof T)[], message: string): void`, so callers can pass `options` without casting.

---

## 5. Duplicate backoff delay calculation

**Severity: Low** · **Importance: Low**

### Locations

- **`src/lib/common.ts`** in `doRequest`: `const delayMs = 1000 * 2 ** attempt` appears twice (lines ~81 and ~100) for retry backoff.

### Recommendation

- Extract to a small helper, e.g. `function getRetryDelayMs(attempt: number): number { return 1000 * 2 ** attempt; }`, and call it in both branches. Reduces duplication and makes backoff policy a single place to change.

---

## 6. Repeated “id/appId required” + resolveAppId pattern

**Severity: Low (DRY)** · **Importance: Defer**

### Locations

- **`src/lib/reviews.ts`**: Validates `id` or `appId`, then if `appId` provided and `id` missing calls `resolveAppId`, then defensively checks `id != null` before building the URL.
- **`src/lib/similar.ts`**: Same flow—`validateRequiredField`, optional `resolveAppId`, then defensive `id == null` check.

The pattern is identical: ensure at least one of id/appId → resolve bundle ID to numeric id if needed → ensure numeric id for the rest of the function.

### Recommendation

- Consider a small helper, e.g. `ensureNumericId(options: { id?: number; appId?: string }, resolve: (opts: ResolveAppIdOptions) => Promise<number>, country: string, requestOptions?: RequestOptions): Promise<number>`, which runs validation, calls resolve when needed, and returns the numeric id or throws. Would remove duplicated logic in reviews and similar; only worth it if more methods adopt id/appId in the future.

---

## 8. ~~Duplicate “200” limit constant~~ (resolved)

**Status: Done.** Added `ITUNES_API_MAX_LIMIT` and `BODY_PREVIEW_MAX_LEN` in `src/types/constants.ts`. Used in `search.ts`, `list.ts`, `validate.ts`, and `common.ts`.

---

## Summary table

| # | Category                          | Severity | Importance | Effort  | Notes                                              |
|---|-----------------------------------|----------|------------|---------|----------------------------------------------------|
| 1 | List/suggest throw Error not ValidationError | Low      | **Medium** | Trivial | Use ValidationError(..., 'response') in list.ts, suggest.ts |
| 2 | options as Record&lt;string, unknown&gt;      | Low      | Low        | Low     | Optional: generic/overload for validateRequiredField |
| 4 | storeId 143441 fallback           | Low      | Low        | Trivial | Named constant; document or use markets.us only   |
| 5 | Duplicate backoff in doRequest    | Low      | Low        | Trivial | getRetryDelayMs(attempt)                          |
| 6 | id/appId + resolveAppId pattern   | Low      | **Defer**  | Medium  | Optional helper if more methods need it            |
| 7 | 404 → empty pattern               | Low      | **Defer**  | Low–Med | Optional doRequestOrNull helper                    |
| 9 | Test assertions                   | Very low | **Defer**  | —       | Acceptable; optional test helpers                 |

### Importance rationale (pragmatic)

- **1 (Medium):** Callers cannot reliably `instanceof ValidationError` or check `err.field` for list/suggest; fix when touching those files so error handling is consistent.
- **2, 4–5 (Low):** Cosmetic or small DRY wins; do if trivial when already in file, or in a dedicated cleanup pass. **3, 8:** Resolved.
- **6, 7, 9 (Defer):** Only two/four call sites; abstracting now is YAGNI. Revisit if a third+ similar method appears or when refactoring that area.

---

## References

- **Project standards:** `.cursor/rules/project-standards.mdc`
- **Postponed work:** `docs/POSTPONED.md` (do not re-propose postponed items as code smells)
- **Security/URL construction:** Already documented in POSTPONED.md (allowlist validation in place)
