# Roadmap

> Status: sunset plan. `usdh-kit` stays focused on USDH migration and
> maintenance. It should not become a generic USDC, spot, or HIP-4 SDK.
> Release remains gated on review, CI, and explicit approval.

## TL;DR

The repo now has two jobs:

1. Help users migrate remaining HyperCore USDH back to USDC.
2. Preserve the SDK/widget/demo work as open-source legacy reference material.

Future HIP-4 SDK or UI tooling should live in a separate repo/package with a
clean name and API. `usdh-kit` should not absorb that future product surface.

## Current Baseline

What already works:

- `USDH -> USDC` HyperCore migration swaps.
- `USDHMigration`, a wallet-gated React migration widget.
- Legacy `USDC -> USDH` quote/swap and `bridgeAndSwap()` flows for historical integrations.
- HyperEVM -> HyperCore bridge for USDC.
- HyperCore -> HyperEVM bridge-out for linked USDC/USDH spot assets.
- USDH spot discovery with `listPairs`, `getPair`, `getBook`, and `getMids`.
- Experimental read-only outcome discovery with `listOutcomeMarkets`,
  `getOutcomeMarket`, `getOutcomeBook`, and `getOutcomeMids`.
- USDH-scoped spot orders with `placeOrder`, `cancelOrder`, `getOpenOrders`, and
  `getOrderStatus`.
- Demo registry patterns for migration UX and archived HIP-4 read-only references.

## Release Gate

A final release, if approved, should be explicitly framed as a sunset/migration
release:

- Promote `USDHMigration` as the primary widget.
- Keep `USDHSwap` available but documented as legacy/historical.
- Do not publish a generic spot SDK.
- Do not publish React HIP-4 components from this repo.
- Do not add new USDH acquisition roadmap items.
- Keep changesets intentional and review package output before publish.

## HIP-4 Direction

The HIP-4 work in this repo is useful as prior art and reference material:

- outcome market reads;
- side coin decoding;
- book summaries;
- builder-oriented UI patterns in `apps/demo`.

It is not the final HIP-4 product surface. If the team proceeds with HIP-4
tooling, start a new repo/package and decide the public boundaries there:

- headless SDK helpers;
- optional hooks package;
- no bundled visual design system unless explicitly scoped;
- clear write/read boundaries;
- live market fixtures and docs from day one.

## Non-goals

- Becoming a generic Hyperliquid SDK.
- Becoming a generic USDC spot SDK.
- Expanding `@usdh-kit/widget` into a broad widget suite.
- Publishing registry/demo UI components as package API.
- Adding new USDH acquisition features while USDH is sunset.
- Merging the USDC-canonical spike as-is.
