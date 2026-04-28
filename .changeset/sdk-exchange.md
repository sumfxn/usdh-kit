---
'usdh-kit': minor
---

Internal Hyperliquid `/exchange` transport. `createExchangeClient` posts a signed L1 action with nonce and optional `vaultAddress` to the exchange endpoint, validates the top-level `{ status, response }` envelope, and returns the parsed response. `OrderResponse` and `isOrderResponse` runtime guard typed for the `order` action. `NetworkError` wraps HTTP, transport, JSON, and timeout failures.
