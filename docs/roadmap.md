# Roadmap

> Status: living plan. Tracks 1-3 have landed; Track 4 useful USDH flows are
> the next SDK expansion. Release remains intentionally gated until live
> testnet/IRL validation and generated release output are reviewed.
> Direction: keep `usdh-kit` centered on USDH, but expand from "obtain USDH via
> USDC" to "interact cleanly with USDH surfaces on Hyperliquid".

## TL;DR

`usdh-kit` should not become a generic Hyperliquid SDK. It should expose the
small set of primitives that make USDH useful:

1. discover USDH markets and USDH-denominated surfaces
2. work with USDH outcomes first, if markets are natively `/USDH`
3. trade USDH markets through a focused order API
4. keep the current USDC -> USDH acquisition flow simple
5. treat HyperEVM direct swaps as a separate spike until liquidity/routing is
   validated

## Current SDK baseline

What already works:

- `USDC -> USDH` quote and swap on HyperCore
- HyperEVM -> HyperCore bridge for USDC
- HyperCore balance reads and route/preflight helpers
- `bridgeAndSwap()` for route -> optional bridge -> swap
- USDH spot discovery with `listPairs`, `getPair`, `getBook`, and `getMids`
- experimental read-only outcome discovery with `listOutcomeMarkets`,
  `getOutcomeMarket`, `getOutcomeBook`, and `getOutcomeMids`
- USDH-only spot orders with `placeOrder`, `cancelOrder`, `getOpenOrders`, and
  `getOrderStatus`
- `InfoClient` reads for `spotMeta`, `outcomeMeta`,
  `spotClearinghouseState`, `l2Book`, `allMids`, `frontendOpenOrders`, and
  `orderStatus`
- typed lifecycle errors, including `BridgeAndSwapError` and
  `isBridgeAndSwapError()`
- React widget on top of the SDK

This remains the core retail path. New roadmap items should preserve that simple
path instead of forcing integrators into a broader trading abstraction.

## Track 1 - Discovery USDH

Owner: @Yaugourt

Status: landed for spot market discovery in PR #49. HIP-3 remains watchlist,
and outcomes continue as the separate Track 2 surface.

Expose the markets and surfaces related to USDH. Start with spot markets, keep
outcomes clearly in scope, and keep HIP-3 as experimental/watchlist until the
shape is validated.

### Goals

- Replace one-off `USDH/USDC` pair lookup with USDH-aware discovery.
- Let consumers list USDH spot markets without hand-parsing Hyperliquid metadata.
- Preserve explicit orientation: USDH can be base or quote.
- Return enough metadata for UI, quoting, and later order placement.
- Avoid promising generic Hyperliquid market discovery.

### Proposed API

```ts
kit.listPairs({ quote?: 'USDH', kind?: 'spot' }): Promise<UsdhPair[]>
kit.getPair({ base, quote, kind?: 'spot' }): Promise<UsdhPair>
kit.getBook(pair: string, opts?: { nSigFigs?: NSigFigs }): Promise<L2Book>
kit.getMids(opts?: { quote?: 'USDH' }): Promise<Record<string, string>>
```

Types should make orientation explicit:

```ts
type UsdhPair = {
  kind: 'spot'
  name: string
  base: string
  quote: string
  usdhRole: 'base' | 'quote'
  index: number
  tokens: [number, number]
}
```

### Scope

- Shipped:
  - spot pairs where USDH is base or quote
  - book/mid helpers for those pairs
  - caching by pair name or token tuple
  - testnet/mainnet token-index handling behind existing network config
- Watchlist:
  - HIP-3 USDH-denominated markets
  - outcome write support, only after denomination/settlement behavior is
    verified
- Out of scope:
  - generic pair discovery for all assets
  - generic perps SDK
  - routing across arbitrary token graphs

## Track 2 - Outcomes USDH

Owner: @sumfxn

Status: landed as PR #51. The API is read-only and experimental: metadata, side
encoding helpers, books, and mids only. It does not add outcome orders,
cancellations, or settlement/denomination claims.

Prioritize this if outcomes are natively denominated in USDH. This is a stronger
USDH use case than generic perps because it creates direct demand for USDH as the
settlement/quote asset.

### Goals

- Discover USDH-denominated outcome markets.
- Read outcome books and mids with the same ergonomics as spot.
- Make outcome support clearly experimental until tested against live/testnet
  markets.
- Keep the outcome API narrow and product-shaped.

### Proposed API

```ts
kit.listOutcomeMarkets(): Promise<UsdhOutcomeMarket[]>
kit.getOutcomeMarket({ outcome }): Promise<UsdhOutcomeMarket>
kit.getOutcomeBook({ outcome, side, nSigFigs? }): Promise<L2Book>
kit.getOutcomeMids(): Promise<Record<string, string>>
```

Possible later write path:

```ts
kit.placeOutcomeOrder({
  market,
  side,
  price,
  size,
  tif,
}): Promise<OrderResult>
```

### Spike findings

- `outcomeMeta` exposes a separate outcome namespace from spot pairs.
- Side coins use encoded `#...` names derived from outcome id and binary side.
- Live read-only probes validate `outcomeMeta`, `l2Book`, and outcome mids on
  mainnet and testnet.
- USDH settlement/denomination remains unclaimed until verified separately.
- Write support remains out of scope.

## Track 3 - Targeted USDH trading

Owner: @Yaugourt

Status: landed as PR #54. The final API stays USDH-scoped while accepting both
live Hyperliquid pair names such as `@230` and ergonomic token aliases such as
`USDH/USDC`.

Build only the trading primitives needed for USDH markets:

```ts
kit.placeOrder({ pair, side, size, price?, tif?, slippageBps? })
kit.cancelOrder({ pair, oid })
kit.getOpenOrders({ pair? })
kit.getOrderStatus({ pair, oid })
```

This should be a focused USDH-market order layer, not a full Hyperliquid SDK.
`pair` accepts the live `listPairs()` name such as `@230` and ergonomic token
aliases such as `USDH/USDC` or `HYPE/USDH`; reads remain filtered to USDH-bearing
spot pairs.

### Scope

- In scope:
  - `placeOrder`
  - `cancelOrder`
  - `getOpenOrders`
  - `getOrderStatus`
  - shared order formatting/signing reused by `swap()`
  - typed order errors and `friendlyError()` mappings
- Later:
  - modify order
  - batch helpers
  - vault/subaccount support
  - agent wallets
  - TWAP/dead-man switch

`swap()` should remain a high-level convenience wrapper, not be replaced by a
lower-level order API in docs.

## Track 4 - Useful USDH flows

Keep the UX simple:

- `USDC -> USDH` remains the core path
- add `USDH -> USDC`
- add `bridgeFromCore`
- avoid arbitrary multi-hop routing for now

### Proposed additions

```ts
kit.swap({ from: 'USDH', to: 'USDC', amount, ... })
kit.bridgeFromCore({ asset: 'USDC' | 'USDH', amount, recipient? })
```

Multi-hop via arbitrary intermediate assets should stay out of scope until there
is a clear product need and enough tests to make route selection safe.

## Track 5 - HyperEVM direct swap

Treat as a separate spike.

Before promising this in public API, validate:

- USDH liquidity on HyperEVM
- which DEX/router to integrate first
- quote accuracy
- slippage and `minOut` behavior
- allowance flow
- gas and failure modes

Possible future shape:

```ts
kit.evmQuote({ from, to, amount }): Promise<EvmQuote>
kit.evmSwap({ from, to, amount, minOut?, recipient?, deadline? }): Promise<EvmSwapResult>
```

Do not block shipped tracks on this.

## Landed Split

The initial SDK expansion landed as three focused PRs:

1. @Yaugourt: Track 1, Discovery USDH
   - spot USDH market discovery first
   - book/mid helpers
   - API and tests only for confirmed metadata shape
   - leave hooks/types clean enough for outcomes, but do not implement outcomes
     in the same PR

2. @sumfxn: Track 2, Outcomes USDH
   - inspect real outcome metadata/API shape
   - land a read-only experimental API if the shape is stable enough
   - document any unknowns before write support

3. @Yaugourt: Track 3, Targeted USDH trading
   - spot order placement and cancellation for USDH-bearing pairs
   - USDH-filtered open orders and order status reads
   - live pair names plus token-pair aliases
   - no generic Hyperliquid account/order surface

## Non-goals

- Becoming a generic Hyperliquid SDK
- Generic perps support
- Arbitrary routing/multi-hop
- HyperEVM direct swap before liquidity and router validation
- Broad agent/vault support before the USDH-specific API is settled

## Decisions And Open Questions

Resolved decisions:

1. `listPairs()` is spot-only and USDH-scoped.
2. Outcomes use separate `listOutcomeMarkets()` style APIs.
3. Track 3 supports only USDH-bearing spot pairs, not generic Hyperliquid
   trading.

Open questions:

1. Which API should expose HIP-3 USDH markets, if any? Proposed: experimental
   watchlist after spot/outcomes.
2. What is the minimum useful `bridgeFromCore` API for integrators?
3. Which examples should become first-class maintained demos before the next
   release?
