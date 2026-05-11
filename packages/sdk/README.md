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

* `getQuote()` and `swap()` for `USDC → USDH` end to end (signing + msgpack + IOC limit submission)
* `bridgeToCore()` for moving USDC from HyperEVM to HyperCore, with credit polling
* `getHypercoreBalance()` for spendable HyperCore balances (`total - hold`)
* `getRoute()` / `preflightSwap()` for HyperCore-vs-HyperEVM source selection
* `bridgeAndSwap()` for route → optional bridge → swap orchestration
* USDH spot market discovery (`listPairs`, `getPair`, `getBook`, `getMids`)
* Experimental read-only outcome market metadata, books, and mids
* Read-only `InfoClient` (spotMeta, outcomeMeta, spotClearinghouseState, L2 book, allMids)

Deferred to follow-up PRs: USDT pricing/swap, reverse direction (USDH → USDC), multi-chain source.

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

`swap()` submits an IOC limit order priced `slippageBps` above the mid (max
slippage is enforced pre-fill by Hyperliquid's matcher). The returned
`result.slippageBps` is the realised slippage versus mid; tighten the tolerance
and retry if it's higher than you expected.

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
```

## Route and preflight

`getHypercoreBalance()` returns total, held, and spendable HyperCore balance for a source stable. `getRoute()` decides whether the user can swap directly from HyperCore or needs to bridge from HyperEVM first. It checks spendable HyperCore source balance (`total - hold`), applies the configured slippage plus a small HC fee buffer, and returns a quote alongside the route decision.

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
