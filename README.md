# usdh-kit

[![CI](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@usdh-kit/sdk?style=flat&color=000000)](https://www.npmjs.com/package/@usdh-kit/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-000000.svg)](./LICENSE)

TypeScript SDK to swap stablecoins (USDC, USDT) into USDH on Hyperliquid.

USDH is the native stablecoin on Hyperliquid, issued by Bridge and designed by Native Markets, with 50% of reserve revenue routed to the Hyperliquid Assistance Fund. `@usdh-kit/sdk` ships the retail-side plumbing (pair resolution, signing, transport) so apps and bots can convert into USDH without writing the Hyperliquid action layer themselves.

## Status

Pre-release. Public API is unstable until `1.0.0`.

* `getQuote()` is wired and reads live HL orderbook
* `swap()` validates input but throws `NotImplementedError` until the signing layer lands
* USDT pricing throws `NotImplementedError` until the USDT/USDC/USDH double-hop lands

## Install

```sh
pnpm add @usdh-kit/sdk
```

## Quickstart

```ts
import { createUsdhKit, SlippageExceededError } from '@usdh-kit/sdk'

const kit = createUsdhKit({ network: 'mainnet', signer })

try {
  const result = await kit.swap({ from: 'USDC', amount: 1_000_000n })
  console.log(`got ${result.received} USDH for ${result.spent} USDC`)
} catch (err) {
  if (err instanceof SlippageExceededError) {
    // tighten slippageBps and retry, or surface to the user
  }
  throw err
}
```

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

* `USDC -> USDH` quote and swap via the canonical HL spot pair
* Wallet-agnostic `Signer` interface (works with viem, ethers, Privy, Turnkey, raw private key)
* Typed error hierarchy rooted at `UsdhKitError` for clean `instanceof` handling
* npm provenance on every release
* Mainnet and testnet support, no signing on read paths

## Runtime support

* Node.js >= 18.18 (native `fetch`, `AbortController`, `bigint`)
* Bun >= 1.1
* Modern evergreen browsers (Chrome >= 107, Safari >= 16, Firefox >= 104)
* Edge runtimes (Cloudflare Workers, Vercel Edge)

Consumers targeting older environments must downlevel via their bundler.

## Why USDH

Hyperliquid's primary stable was USDC, bridged from Arbitrum. USDH is native, fully reserved (cash plus US treasuries), and routes 50% of reserve revenue to the Assistance Fund instead of an issuer. Apps that hold or pay out stables on Hyperliquid have a reason to prefer USDH; this SDK removes the friction.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Security disclosures: [`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE)
