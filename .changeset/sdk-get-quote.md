---
'usdh-kit': minor
---

Implement `getQuote()` for `USDC -> USDH`. Resolves the spot pair from `spotMeta` (cached for the lifetime of the kit), reads the L2 book, and computes a mid-price quote with a 30-second validity window. `KitConfig` now accepts optional `fetch` and `timeoutMs`. USDT pricing throws `NotImplementedError` until the double-hop lands. `Quote` adds a `pair` field naming the spot pair used.
