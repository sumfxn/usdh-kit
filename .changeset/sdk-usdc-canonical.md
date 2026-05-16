---
'@usdh-kit/sdk': minor
---

Make USDC the canonical default quote for discovery and relax order pair resolution to any spot pair.

`listPairs()`, `getPair()`, and `getMids()` now default to USDC-quoted pairs. Pass `{ quote: 'USDH' }` to retain the legacy USDH-quoted behaviour. `placeOrder`, `cancelOrder`, `getOpenOrders`, and `getOrderStatus` now accept any spot pair from `spotMeta`, not only USDH-bearing ones. `getOpenOrders()` with no pair filter returns all open orders instead of filtering to USDH pairs. All USDH pair paths and the swap/bridge layer are unchanged.
