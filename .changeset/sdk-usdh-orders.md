---
'@usdh-kit/sdk': minor
---

Add USDH-only spot order layer. The kit now exposes `placeOrder`,
`cancelOrder`, `getOpenOrders`, and `getOrderStatus`, all gated to spot pairs
where USDH is base or quote. `placeOrder` accepts a limit price (with
`tif: 'Gtc' | 'Ioc' | 'Alo'`) or, when omitted, runs as a slippage-tolerant
market order via IOC. `swap()` is unchanged. `InfoClient` gains
`frontendOpenOrders` and `orderStatus` reads to back the new methods.
