# Code Smells Review: app-store-scraper

## 6. Repeated “id/appId required” + resolveAppId pattern

**Severity: Low (DRY)** · **Importance: Defer**

### Locations

- **`src/lib/reviews.ts`**: Validates `id` or `appId`, then if `appId` provided and `id` missing calls `resolveAppId`, then defensively checks `id != null` before building the URL.
- **`src/lib/similar.ts`**: Same flow—`validateRequiredField`, optional `resolveAppId`, then defensive `id == null` check.

The pattern is identical: ensure at least one of id/appId → resolve bundle ID to numeric id if needed → ensure numeric id for the rest of the function.

### Recommendation

- Consider a small helper, e.g. `ensureNumericId(options: { id?: number; appId?: string }, resolve: (opts: ResolveAppIdOptions) => Promise<number>, country: string, requestOptions?: RequestOptions): Promise<number>`, which runs validation, calls resolve when needed, and returns the numeric id or throws. Would remove duplicated logic in reviews and similar; only worth it if more methods adopt id/appId in the future.

---

## Summary table

| # | Category                          | Severity | Importance | Effort  | Notes                                              |
|---|-----------------------------------|----------|------------|---------|----------------------------------------------------|
| 6 | id/appId + resolveAppId pattern   | Low      | **Defer**  | Medium  | Optional helper if more methods need it            |
| 7 | 404 → empty pattern               | Low      | **Defer**  | Low–Med | Optional doRequestOrNull helper                    |
| 9 | Test assertions                   | Very low | **Defer**  | —       | Acceptable; optional test helpers                 |
