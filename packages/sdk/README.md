# @usdh-kit/sdk

[![CI](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@usdh-kit/sdk?style=flat&color=000000)](https://www.npmjs.com/package/@usdh-kit/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-000000.svg)](../../LICENSE)

TypeScript SDK to swap stablecoins into USDH on Hyperliquid.

USDH is the native stablecoin on Hyperliquid, issued by Bridge and designed by Native Markets, with 50% of reserve revenue routed to the Hyperliquid Assistance Fund. `@usdh-kit/sdk` ships the retail-side plumbing (pair resolution, signing, transport) so apps and bots can convert into USDH without writing the Hyperliquid action layer themselves.

## Status

Pre-release. Public API is unstable until `1.0.0`.

What works today:

* `getQuote()` and `swap()` for `USDC → USDH` end to end (signing + msgpack + IOC limit submission)
* `bridgeToCore()` for moving USDC from HyperEVM to HyperCore, with credit polling
* Read-only `InfoClient` (spotMeta, spotClearinghouseState, L2 book)

Deferred to follow-up PRs: USDT pricing/swap, reverse direction (USDH → USDC), multi-chain source, `bridgeAndSwap` helper.

## Install

```sh
pnpm add @usdh-kit/sdk
```

## Quickstart

```ts
import { createUsdhKit } from '@usdh-kit/sdk'

const kit = createUsdhKit({ network: 'mainnet', signer, slippageBps: 30 })

const result = await kit.swap({ from: 'USDC', amount: 1_000_000n })
console.log(`got ${result.received} USDH for ${result.spent} USDC`)
console.log(`realised slippage: ${result.slippageBps}bps`)
```

`swap()` submits an IOC limit order priced `slippageBps` above the mid (max
slippage is enforced pre-fill by Hyperliquid's matcher). The returned
`result.slippageBps` is the realised slippage versus mid; tighten the tolerance
and retry if it's higher than you expected.

## Quote a swap

`getQuote()` returns a mid-price snapshot with a 30-second validity window.

```ts
const quote = await kit.getQuote({ from: 'USDC', amount: 1_000_000n })
if (Date.now() < quote.validUntil) {
  console.log(`mid-price on ${quote.pair}: ${quote.midPrice}`)
  console.log(`would receive ~${quote.estimatedReceived} USDH`)
}
```

## Features (V1)

* `USDC → USDH` quote and swap via the canonical HL spot pair
* HyperEVM → HyperCore bridge with credit polling (`bridgeToCore`)
* Wallet-agnostic `Signer` interface (works with viem, ethers, Privy, Turnkey, raw private key)
* Read-only `InfoClient` (spotMeta, spot clearinghouse state, L2 book)
* Typed error hierarchy rooted at `UsdhKitError` for clean `instanceof` handling
* npm provenance on every release
* Mainnet and testnet support, no signing on read paths

## Runtime support

* Node.js >= 18.18 (native `fetch`, `AbortController`, `bigint`)
* Bun >= 1.1
* Modern evergreen browsers (Chrome >= 107, Safari >= 16, Firefox >= 104)
* Edge runtimes (Cloudflare Workers, Vercel Edge)

## License

[MIT](../../LICENSE)
