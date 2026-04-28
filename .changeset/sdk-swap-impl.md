---
'usdh-kit': minor
---

Implement `swap()` end-to-end for `USDC -> USDH`. Reads the L2 orderbook, computes a slippage-tolerant aggressive limit price (`mid * (1 + slippageBps/10000)`), builds a Market IOC order action, signs via the configured `Signer`, submits to `/exchange`, parses the fill, and returns a `SwapResult` with the realised slippage in bps. The slippage check is now **pre-fill** (HL rejects bad prices itself) and the realised value is reported on the result without throwing. `NetworkError` wraps transport and per-order errors. `NotImplementedError` for USDT until the double-hop lands.

`SwapResult.txHash` removed (HL L1 actions have no Ethereum tx hash); `orderId` is the canonical identifier. `ResolvedPair` exposes `assetIndex`, `baseSzDecimals`, and `quoteWeiDecimals` so the kit formats price and size strings against the actual pair precision instead of a hardcoded constant. Nonces are emitted monotonically across concurrent calls. `formatDecimal` accepts an optional `maxFracDigits` cap.
