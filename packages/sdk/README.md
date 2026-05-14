# @usdh-kit/sdk

[![CI](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@usdh-kit/sdk?style=flat&color=000000)](https://www.npmjs.com/package/@usdh-kit/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-000000.svg)](../../LICENSE)

**Current SDK version:** `0.3.0`

TypeScript SDK for USDH on Hyperliquid.

USDH is the native stablecoin on Hyperliquid, issued by Bridge and designed by Native Markets, with 50% of reserve revenue routed to the Hyperliquid Assistance Fund. `@usdh-kit/sdk` ships the retail-side plumbing (pair resolution, signing, transport) so apps and bots can convert into USDH without writing the Hyperliquid action layer themselves.

Contributors: [Yaugourt](https://x.com/Yaugourt) · [Sumfxn](https://x.com/sumfxn)

## Status

Pre-release. Public API is unstable until `1.0.0`.

What works today:

* `getQuote()` and `swap()` for `USDC → USDH` and `USDH → USDC` end to end (signing + msgpack + IOC limit submission)
* `bridgeToCore()` for moving USDC from HyperEVM to HyperCore, with credit polling
* `bridgeFromCore()` for moving linked USDC/USDH spot assets from HyperCore to HyperEVM
* `getHypercoreBalance()` for spendable HyperCore balances (`total - hold`)
* `getRoute()` / `preflightSwap()` for HyperCore-vs-HyperEVM source selection
* `bridgeAndSwap()` for route → optional bridge → swap orchestration
* USDH spot market discovery (`listPairs`, `getPair`, `getBook`, `getMids`)
* Experimental read-only outcome market metadata, books, and mids
* Read-only `InfoClient` (spotMeta, outcomeMeta, spotClearinghouseState, L2 book, allMids)

Deferred to follow-up PRs: USDT pricing/swap and multi-chain source.

## Install

```sh
pnpm add @usdh-kit/sdk
```

## Quickstart

```ts
import { BridgeTimeoutError, createUsdhKit, isBridgeAndSwapError } from '@usdh-kit/sdk'

const kit = createUsdhKit({ network: 'mainnet', signer, evmWallet, slippageBps: 30 })
const amount = 11_000_000n // 11 USDC; Hyperliquid spot orders must be >10 USDC

try {
  const result = await kit.bridgeAndSwap({
    from: 'USDC',
    amount,
    onProgress: (event) => console.log(event.phase),
  })

  console.log(`got ${result.swap.received} USDH for ${result.swap.spent} USDC`)
} catch (err) {
  if (isBridgeAndSwapError(err)) {
    console.error(`${err.phase} failed`, err.cause)
    if (err.cause instanceof BridgeTimeoutError) {
      console.log(`bridge tx ${err.cause.txHash} is still pending HyperCore credit`)
    }
  }
  throw err
}
```

`swap()` submits an IOC limit order priced from the book mid plus/minus
`slippageBps` depending on direction. The returned `result.slippageBps` is the
realised slippage versus mid; tighten the tolerance and retry if it's higher
than you expected.

## Agent wallets

Browser wallets can reject Hyperliquid L1 order signatures because orders use Hyperliquid's `Exchange` typed-data domain (`chainId: 1337`), not the connected HyperEVM chain. The recommended production pattern is a Hyperliquid API/agent wallet:

* the master wallet approves the agent once with `approveAgent()`
* the agent signs L1 trading actions
* reads, routing, balances, and bridge ownership still use the master account via `accountAddress`

```ts
import { approveAgent, createUsdhKit } from '@usdh-kit/sdk'

await approveAgent({
  network: 'mainnet',
  signer: masterWalletSigner,
  agentAddress: agentSigner.address,
  agentName: 'my-app-usdh',
  signatureChainId: 999, // match the connected HyperEVM chain for browser wallets
})

const kit = createUsdhKit({
  network: 'mainnet',
  signer: agentSigner,
  accountAddress: masterWalletSigner.address,
  evmWallet: masterEvmWallet,
  slippageBps: 30,
})
```

Backend and bot builders can provide an already-approved agent signer from a private key or key-management system. Frontend builders should keep any generated browser agent short-lived, scoped to the current account/network, and avoid logging private keys, raw signatures, or full typed-data payloads.

## Quote a swap

`getQuote()` returns a mid-price snapshot with a 30-second validity window.

```ts
const quote = await kit.getQuote({ from: 'USDC', amount: 11_000_000n })
if (Date.now() < quote.validUntil) {
  console.log(`mid-price on ${quote.pair}: ${quote.midPrice}`)
  console.log(`would receive ~${quote.estimatedReceived} USDH`)
}

const reverse = await kit.getQuote({ from: 'USDH', to: 'USDC', amount: 11_000_000n })
console.log(`would receive ~${reverse.estimatedReceived} USDC`)
```

## Route and preflight

`getHypercoreBalance()` returns total, held, and spendable HyperCore balance for
a source stable. `getRoute()` decides whether `USDC -> USDH` can swap directly
from HyperCore or needs to bridge from HyperEVM first. `USDH -> USDC` is
HyperCore-only: bridge USDH to HyperCore first, swap, then call
`bridgeFromCore()` if you need the resulting USDC on HyperEVM.

```ts
const balance = await kit.getHypercoreBalance({ asset: 'USDC' })
console.log(`spendable HC USDC: ${balance.available}`)

const route = await kit.preflightSwap({ from: 'USDC', amount: 11_000_000n })

if (!route.canSwap) {
  console.log(route.blockReason)
}

if (route.requiresBridge) {
  console.log('will bridge from HyperEVM before swapping')
}
```

`getRoute()` does not inspect the user's HyperEVM ERC20 balance. If it selects
the bridge route, `canSwap` only means the kit has an `evmWallet` configured;
the wallet/RPC will still reject an underfunded bridge transaction.

## Reverse swap and bridge out

`USDH -> USDC` uses the same `USDH/USDC` spot pair, but sells USDH instead of
buying it. It is intentionally HyperCore-only.

```ts
const sold = await kit.swap({ from: 'USDH', to: 'USDC', amount: 11_000_000n })
console.log(`got ${sold.received} USDC`)
```

`bridgeFromCore()` sends linked spot assets from HyperCore to their token system
address. Hyperliquid credits the EVM recipient as the sender of the Core action,
so this helper requires the configured signer to be the master account
(`signer.address === accountAddress`); approved agent wallets cannot withdraw
Core funds for another account. It resolves when Hyperliquid accepts the
`sendAsset` action; the HyperEVM credit is asynchronous and should be confirmed
separately before treating funds as spendable on HyperEVM.

```ts
const out = await kit.bridgeFromCore({ asset: 'USDC', amount: sold.received })
console.log(out.status, out.systemAddress, out.submittedAt)
```

## Discover USDH spot markets

`listPairs()` returns every Hyperliquid spot pair where USDH is either base or
quote. Spot pair names often use Hyperliquid's `@<spotIndex>` format; pass the
returned `pair.name` back into `getBook()`.

```ts
const pairs = await kit.listPairs()
const usdhQuotes = await kit.listPairs({ quote: 'USDH' })

const hypeUsdh = await kit.getPair({ base: 'HYPE', quote: 'USDH' })
const book = await kit.getBook(hypeUsdh.name, { nSigFigs: 5 })
const mids = await kit.getMids({ quote: 'USDH' })

console.log(pairs.length, usdhQuotes.length, book.coin, mids[hypeUsdh.name])
```

## Read outcome markets

Outcome support is experimental and read-only. It exposes Hyperliquid outcome
metadata and encoded side books without making settlement or denomination
claims. Outcome side coins use Hyperliquid's `#<encoding>` format where
`encoding = 10 * outcome + side`.

```ts
const outcomes = await kit.listOutcomeMarkets()
const market = await kit.getOutcomeMarket({ outcome: outcomes[0].outcome })

const yesBook = await kit.getOutcomeBook({
  outcome: market.outcome,
  side: 0,
  nSigFigs: 5,
})
const outcomeMids = await kit.getOutcomeMids()

console.log(market.name, yesBook.coin, outcomeMids[market.sides[0].coin])
```

## Experimental HIP-4 builder helpers

The SDK also exports public, experimental, headless helpers for app builders.
They do not render React components; they turn raw SDK reads into UI-ready data
contracts for HIP-4 event cards, market rows, side selectors, order books,
positions, plus USDH quote guards and order drafts.

These helpers are additive and read-only/draft-only. Until `1.0.0`, treat the
exact return shapes as pre-release API, but prefer them over app-local parsing:
they centralize side-coin encoding, quote health checks, decimal-safe position
math, and signer-ready order draft validation.
The core builder examples are mirrored in SDK tests so package examples fail
fast if helper signatures drift.

```ts
import {
  createInfoClient,
  createOutcomeEventData,
  createOutcomeMarketRows,
  createOutcomeOrderBookLevels,
  createOutcomeOrderBookSummary,
  createOutcomePositionData,
  createOutcomePositionDataFromSide,
  createOutcomePositionRows,
  createOutcomeSideSelection,
  createQuoteReadiness,
  createQuoteSummaryData,
  createSpotOrderDraft,
  resolveOutcomeMarketSide,
} from '@usdh-kit/sdk'

const info = createInfoClient({ network: 'mainnet' })
const [pair] = await kit.listPairs()
const pairBook = pair ? await kit.getBook(pair.name, { nSigFigs: 5 }) : null
const readiness = createQuoteReadiness({
  pair,
  book: pairBook,
  maxSpreadBps: 10,
  minSideDepth: 1000,
})
const quoteSummary = createQuoteSummaryData({
  pair,
  book: pairBook,
  amount: '250',
  payAsset: 'USDC',
  maxSpreadBps: 10,
  minSideDepth: 1000,
})

const markets = await kit.listOutcomeMarkets()
const [market] = markets
const yesBook = await kit.getOutcomeBook({ outcome: market.outcome, side: 0, nSigFigs: 5 })
const noBook = await kit.getOutcomeBook({ outcome: market.outcome, side: 1, nSigFigs: 5 })
const outcomeMids = await kit.getOutcomeMids()
const accountState = await info.spotClearinghouseState(accountAddress)

const event = createOutcomeEventData(market, [{ book: yesBook }, { book: noBook }])
const marketRows = createOutcomeMarketRows({
  markets,
  readsByCoin: {
    [market.sides[0].coin]: { book: yesBook },
    [market.sides[1].coin]: { book: noBook },
  },
})
const selectedSide = createOutcomeSideSelection({
  market,
  selected: market.sides[0].coin,
  reads: [{ book: yesBook }, { book: noBook }],
})
const sideBook = createOutcomeOrderBookLevels(yesBook)
const sideBookSummary = createOutcomeOrderBookSummary(yesBook)
const position = createOutcomePositionData({
  market,
  side: market.sides[0].coin,
  quantity: '125.0',
})
const held = createOutcomePositionDataFromSide({
  markets,
  side: '#201',
  quantity: '4.2',
})
const resolvedSide = resolveOutcomeMarketSide([market], '+200')
const portfolioRows = createOutcomePositionRows({
  markets,
  balances: accountState.balances,
  marks: outcomeMids,
})

const ticket = createSpotOrderDraft({
  pair,
  side: 'buy',
  size: '25',
  price: readiness.bestAsk,
  readiness,
  sizeDecimals: 2,
  priceDecimals: 6,
  minNotional: 10,
  availableQuote: '100',
})
```

Use these helpers when building custom prediction-market UI on top of HIP-4:
the parent app still owns routing, refresh intervals, wallet state, and any
write boundary. `createSpotOrderDraft()` returns checks and a `placeOrderInput`
shape for a wallet-gated handoff, but it never signs or submits. It can also
validate draft-only concerns such as TIF, slippage, precision, minimum size,
minimum notional, and available balance before the signer path is enabled.
HIP-4 helpers are read-only in this release; the SDK order layer still scopes
signed order methods to USDH-bearing spot pairs.

Builder flow for HIP-4 apps:

1. Read `outcomeMeta()` or `kit.listOutcomeMarkets()`, then normalize markets.
2. Render discovery/feed rows with `createOutcomeMarketRows()`.
3. Render market cards with `createOutcomeEventData()`.
4. Resolve controlled side selection with `createOutcomeSideSelection()`.
5. Inspect side liquidity with `getOutcomeBook()` plus `createOutcomeOrderBookSummary()`.
6. Resolve account balances into readable positions with `createOutcomePositionRows()`.
7. Keep routing, cache freshness, wallet state, PnL, settlement, and any writes in the parent app.

Package boundaries:

| Layer | Import today | Owns |
| --- | --- | --- |
| `@usdh-kit/sdk` | Read clients, USDH spot discovery, HIP-4 metadata, order methods, and builder data helpers. | Typed reads, normalization, checks, and signer-ready input shapes. |
| `@usdh-kit/widget` | The drop-in USDH swap widget. | A packaged swap UI with wallet-gated writes. |
| `apps/demo` registry | Copy/paste React patterns only. | Example component composition, docs, and visual states. |
| Your app | Your product shell. | Routing, cache policy, wallet/session state, balances, PnL, settlement, and final writes. |

No React hooks or HIP-4 UI package is published in this release. A future
`@usdh-kit/react` package, if added, should stay hooks-only with optional cache
adapters and no bundled visual design system.

## Trade USDH spot pairs

The order layer is scoped to USDH-bearing spot pairs. `pair` accepts the live
`pair.name` returned by `listPairs()` (usually `@<spotIndex>`) or a token alias
such as `USDH/USDC` or `HYPE/USDH`.

```ts
const order = await kit.placeOrder({
  pair: 'USDH/USDC',
  side: 'buy',
  size: '10',
  price: '1',
})

await kit.cancelOrder({ pair: 'USDH/USDC', oid: order.oid })

const openOrders = await kit.getOpenOrders({ pair: 'USDH/USDC' })
const status = await kit.getOrderStatus({ pair: 'USDH/USDC', oid: order.oid })

console.log(openOrders.length, status.status)
```

## Bridge and swap

`bridgeAndSwap()` composes the common retail flow:

1. route/preflight
2. bridge from HyperEVM when required
3. swap on HyperCore

It returns both legs when a bridge happened and emits progress events that can directly drive UI state:

```ts
const result = await kit.bridgeAndSwap({
  from: 'USDC',
  amount: 11_000_000n,
  onProgress: (event) => {
    if (event.phase === 'bridging') showBridgeSpinner()
    if (event.phase === 'swapping') showSwapSpinner()
  },
})

console.log(result.route.sourceChain)
console.log(result.bridge?.txHash)
console.log(result.swap.orderId)
```

Unexpected route, bridge, or swap failures are wrapped in `BridgeAndSwapError`. Use `isBridgeAndSwapError(err)` to narrow the type, then inspect `phase`, `route`, optional `bridge`, and `cause` so apps can show accurate recovery copy without parsing strings. If `cause` is `BridgeTimeoutError`, the EVM transfer was sent and you can show `cause.txHash` while waiting/retrying for HyperCore credit. Preflight blockers still throw their specific errors (`MissingEvmWalletError`, `InsufficientBalanceError`).

## Features (V1)

* `USDC → USDH` quote and swap via the canonical HL spot pair
* HyperEVM → HyperCore bridge with credit polling (`bridgeToCore`)
* HyperCore → HyperEVM bridge-out for linked USDC/USDH spot assets (`bridgeFromCore`)
* `USDH → USDC` reverse swap on HyperCore
* `getRoute()` / `preflightSwap()` route selection and preflight metadata
* `bridgeAndSwap()` high-level orchestration with progress callbacks
* USDH spot market discovery and read-only books/mids for USDH pairs
* Experimental read-only outcome market metadata, books, and mids
* USDH-only spot order helpers for place, cancel, open orders, and order status
* Wallet-agnostic `Signer` interface (works with viem, ethers, Privy, Turnkey, raw private key)
* Read-only `InfoClient` (spotMeta, outcomeMeta, spot clearinghouse state, L2 book, allMids)
* Typed error hierarchy rooted at `UsdhKitError`, including `BridgeAndSwapError` phase/cause context and `isBridgeAndSwapError()` narrowing
* npm provenance on every release
* Mainnet and testnet support, no signing on read paths

## Runtime support

* Node.js >= 18.18 (native `fetch`, `AbortController`, `bigint`)
* Bun >= 1.1
* Modern evergreen browsers (Chrome >= 107, Safari >= 16, Firefox >= 104)
* Edge runtimes (Cloudflare Workers, Vercel Edge)

## License

[MIT](../../LICENSE)
