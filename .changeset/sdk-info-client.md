---
'usdh-kit': minor
---

Internal Hyperliquid `/info` client. Read-only `spotMeta` and `l2Book` queries via native `fetch`, with `NetworkError` wrapping HTTP, transport, and JSON parse failures. Used by upcoming `getQuote()` implementation.
