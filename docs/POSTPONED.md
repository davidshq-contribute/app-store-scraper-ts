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
