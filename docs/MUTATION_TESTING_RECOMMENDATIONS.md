# Mutation Testing Recommendations

Stryker mutation testing run on 2026-03-14 revealed an overall **55.38% mutation score** across 1170 mutants (648 killed, 522 survived). This document prioritizes the gaps and recommends concrete steps to improve test quality.

## Score Summary

| Priority | File | Score | Survived | Key Gap |
|----------|------|-------|----------|---------|
| 1 | similar.ts | 33.90% | 39 | No tests for error paths, 404 handling, dedup, or `includeLinkType` branching |
| 2 | reviews.ts | 40.00% | 42 | Feed parsing branches, sort/page defaults, error messages untested |
| 3 | common.ts | 40.39% | 152 | Largest absolute gap — `doRequest` retry/timeout logic, URL construction, `cleanApp` field mapping |
| 4 | errors.ts | 40.00% | 6 | Error class properties (`status`, `field`, `url`) never asserted |
| 5 | list.ts | 42.47% | 84 | RSS feed parsing branches, price/link/image edge cases |
| 6 | app.ts | 47.69% | 68 | Screenshot scraping, ratings integration, `bundleId` lookup path |
| 7 | suggest.ts | 50.00% | 25 | XML parser config, edge-case array handling, validation response errors |
| 8 | search.ts | 54.55% | 25 | `idsOnly` path, entity device mapping, `cleanApp` result transformation |

Files scoring above 70% (parsers.ts, ratings.ts, schemas.ts, validate.ts, privacy.ts, version-history.ts, app-page-details.ts) are in good shape and need only minor attention.

**Importance rationale (pragmatic):** *High* = core infra or tests that give false confidence; fix first. *Medium* = good ROI, catches real bugs. *Low* = already decent score; defer unless polishing. *Skip* = equivalent mutants, not worth killing.

## Phase 3 — Structural Improvements (higher effort)

### 3.1 suggest.ts (25 survivors — score 50.00%) — **Low importance**

- **XML parser configuration** — `ignoreAttributes: false` and `attributeNamePrefix: '@_'` survive mutation. Tests don't use XML with attributes, so changing the parser config doesn't affect output. Add a fixture with XML attributes to catch this.
- **`plist.dict.array` optional chaining** — nested optional chaining operators survive because test fixtures always have well-formed responses. Add a test with partial/malformed plist data.
- **Type filtering** — `.filter((s) => typeof s === 'string' && s.length > 0)` survives. Add a fixture with non-string or empty-string entries in the hints array.

### 3.3 parsers.ts (41 survivors — score 73.03%) — **Low importance**

Most survivors are `OptionalChaining` and `StringLiteral` mutations in field accessor paths (e.g., `entry?.['im:name']?.label`). These require fixture-based tests with:
- Missing optional fields (assert `undefined` or default value)
- Present fields (assert exact extracted value)

### 3.4 schemas.ts (13 survivors — score 71.74%) — **Low importance**

All "covered 0" tests — the schema validation tests create valid/invalid objects but the test assertions don't cause Stryker mutations to fail. Likely because the schemas are used via `safeParse` and the tests only check `success: true/false` without verifying specific error paths in the schema definitions themselves.

---

## Phase 4 — Equivalent Mutants (can be ignored) — **Skip**

Some survived mutants are **equivalent** — the mutation doesn't change observable behavior. These are not worth killing:

- **StringLiteral on error messages** — e.g., `throw new ValidationError('id is required', "")` — unless you specifically test `.field === 'id'`, mutating the field name to `""` doesn't change behavior. Decide whether error field names are part of the public API contract. If yes, assert them. If not, these can be ignored.
- **OptionalChaining removal** on paths that are always defined by the time they're accessed (e.g., `result.plist.dict?.array` → `result.plist.dict.array` when `dict` is always present in valid responses).
- **Regex anchor removal** (`$` at end of pattern) when input data never has trailing content that would cause a false match.