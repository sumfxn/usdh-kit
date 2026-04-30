# usdh-kit

[![CI](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml)
[![Built for Hyperliquid](https://img.shields.io/badge/built%20for-Hyperliquid-000000?style=flat)](https://hyperliquid.xyz)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-000000?style=flat&logo=typescript&logoColor=white)](./tsconfig.base.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18.18-000000?style=flat&logo=nodedotjs&logoColor=white)](./package.json)
[![Last commit](https://img.shields.io/github/last-commit/sumfxn/usdh-kit?style=flat&color=000000)](https://github.com/sumfxn/usdh-kit/commits/main)
[![Issues](https://img.shields.io/github/issues/sumfxn/usdh-kit?style=flat&color=000000)](https://github.com/sumfxn/usdh-kit/issues)
[![License](https://img.shields.io/badge/License-MIT-000000.svg)](./LICENSE)

<!--
  npm-dependent badges, intentionally commented until @usdh-kit/sdk and
  @usdh-kit/widget are published. Uncomment as part of the first npm
  publish PR (gated on testnet IRL session per the project roadmap).

  [![@usdh-kit/sdk](https://img.shields.io/npm/v/@usdh-kit/sdk?style=flat&color=000000&label=%40usdh-kit%2Fsdk)](https://www.npmjs.com/package/@usdh-kit/sdk)
  [![@usdh-kit/widget](https://img.shields.io/npm/v/@usdh-kit/widget?style=flat&color=000000&label=%40usdh-kit%2Fwidget)](https://www.npmjs.com/package/@usdh-kit/widget)
  [![Downloads](https://img.shields.io/npm/dm/@usdh-kit/sdk?style=flat&color=000000)](https://www.npmjs.com/package/@usdh-kit/sdk)
  [![Bundle](https://img.shields.io/bundlephobia/minzip/@usdh-kit/sdk?style=flat&color=000000&label=sdk%20gzipped)](https://bundlephobia.com/package/@usdh-kit/sdk)
-->


TypeScript SDK and React widget to swap stablecoins into USDH on Hyperliquid.

USDH is the native stablecoin on Hyperliquid, issued by Bridge and designed by Native Markets, with 50% of reserve revenue routed to the Hyperliquid Assistance Fund. `@usdh-kit/sdk` ships the retail-side plumbing (pair resolution, signing, transport) so apps and bots can convert into USDH without writing the Hyperliquid action layer themselves. `@usdh-kit/widget` is an embeddable React component on top of the SDK so dapps can drop in a swap form in a few lines.

- **Source:** [github.com/sumfxn/usdh-kit](https://github.com/sumfxn/usdh-kit)
- **Issues:** [github.com/sumfxn/usdh-kit/issues](https://github.com/sumfxn/usdh-kit/issues)
- **USDH:** [usdh.com](https://usdh.com) (issued by [Bridge](https://bridge.xyz), designed by [Native Markets](https://www.nativemarkets.com))
- **Hyperliquid:** [hyperliquid.xyz](https://hyperliquid.xyz) · [docs](https://hyperliquid.gitbook.io/hyperliquid-docs)

## Status

Pre-release. Public API is unstable until `1.0.0`.

What works today:

- `getQuote()` and `swap()` for `USDC → USDH` end to end (signing + msgpack + IOC limit submission)
- `bridgeToCore()` for moving USDC from HyperEVM to HyperCore, with credit polling
- React widget with built-in source-chain selection (HyperEVM bridge or direct HyperCore swap), friendly errors, and full theming via CSS variables

Deferred to follow-up PRs:

- USDT pricing and swap (USDT/USDC/USDH double-hop)
- Reverse direction (USDH → USDC) and `bridgeFromCore`
- Multi-chain source via LiFi/Squid (Ethereum, Arbitrum, Base)
- `bridgeAndSwap` single-call helper

## Install

```sh
pnpm add @usdh-kit/sdk
```

For the React widget:

```sh
pnpm add @usdh-kit/widget @usdh-kit/sdk wagmi viem @tanstack/react-query react react-dom
```

## SDK quickstart

```ts
import { createUsdhKit } from '@usdh-kit/sdk'

const kit = createUsdhKit({ network: 'mainnet', signer, evmWallet, slippageBps: 30 })

// quote
const quote = await kit.getQuote({ from: 'USDC', amount: 1_000_000n })
console.log(`would receive ~${quote.estimatedReceived} USDH`)

// move USDC from HyperEVM to HyperCore (skip if already on HC)
const bridge = await kit.bridgeToCore({ asset: 'USDC', amount: 1_000_000n })

// swap on HyperCore via IOC limit at mid + slippageBps
const result = await kit.swap({ from: 'USDC', amount: 1_000_000n })
console.log(`got ${result.received} USDH for ${result.spent} USDC`)
console.log(`realised slippage: ${result.slippageBps}bps`)
```

`swap()` submits an IOC limit order priced `slippageBps` above the mid; max slippage is enforced pre-fill by Hyperliquid's matcher. The returned `result.slippageBps` is the realised slippage versus mid.

## Widget quickstart

The widget reads the connected wallet from wagmi. Wrap your tree in `WagmiProvider` and `QueryClientProvider` (e.g. via ConnectKit or RainbowKit), import the stylesheet once at your app root, then drop the component in.

```tsx
// app/layout.tsx (Next.js)
import '@usdh-kit/widget/styles.css'

// app/page.tsx
import { USDHSwap } from '@usdh-kit/widget'

export default function Page() {
  return <USDHSwap network="mainnet" />
}
```

The widget defaults to `theme="auto"` (follows the user's system). Force a palette with `<USDHSwap network="mainnet" theme="dark" />` or `<USDHSwap network="mainnet" theme="light" />`. Override any colour token from your own stylesheet — see [docs/theming.md](./docs/theming.md).

<!-- Replace these placeholders with screenshots once captured. -->
<!--
| Dark | Light |
| --- | --- |
| ![Widget dark](./docs/assets/widget-dark.png) | ![Widget light](./docs/assets/widget-light.png) |
-->

## Use cases

A few real flows you can build with `@usdh-kit/sdk` today. Each example in [`apps/examples/`](./apps/examples) is a runnable Node.js or Next.js app — copy and adapt.

- **End-to-end CLI** ([`node-swap`](./apps/examples/node-swap)) — bridge + quote + swap from a private key on the command line. Smallest possible integration.
- **Stripe → USDH** ([`payment-webhook`](./apps/examples/payment-webhook)) — receive a Stripe webhook, swap the USDC equivalent into USDH from a merchant wallet. Native `node:http` server.
- **Treasury rebalance** ([`treasury-rebalance`](./apps/examples/treasury-rebalance)) — scheduled job that converts a fraction of HyperCore USDC above a floor into USDH. Designed for cron.

## Features (V1)

- `USDC → USDH` quote and swap via the canonical HL spot pair
- HyperEVM → HyperCore bridge with credit polling (`bridgeToCore`)
- Wallet-agnostic `Signer` interface (works with viem, ethers, Privy, Turnkey, raw private key)
- Read-only `InfoClient` (spotMeta, spot clearinghouse state, L2 book) for consumers building custom UIs
- Typed error hierarchy rooted at `UsdhKitError` for clean `instanceof` handling
- `friendlyError()` helper to map SDK errors to short, copy-safe strings
- React widget (`@usdh-kit/widget`) with light, dark and auto theming (WCAG AA defaults, CSS variables for integrator overrides)
- npm provenance on every release
- Mainnet and testnet support, no signing on read paths

## Docs

- [docs/architecture.md](./docs/architecture.md) — what the SDK does under the hood, in the order it does it (msgpack, signing, bridge polling, error model).
- [docs/glossary.md](./docs/glossary.md) — Hyperliquid terms used across the SDK and widget (HyperEVM vs HyperCore, IOC, system address, weiDecimals, …).
- [docs/theming.md](./docs/theming.md) — widget CSS variable list, override patterns, SSR-flash mitigation, Tailwind setup.
- [docs/troubleshooting.md](./docs/troubleshooting.md) — common errors with concrete fixes (`MissingEvmWalletError`, `BridgeTimeoutError`, "borders render bright white", …).

## Runtime support

- Node.js >= 18.18 (native `fetch`, `AbortController`, `bigint`)
- Bun >= 1.1
- Modern evergreen browsers (Chrome >= 107, Safari >= 16, Firefox >= 104)
- Edge runtimes (Cloudflare Workers, Vercel Edge)

Consumers targeting older environments must downlevel via their bundler.

## Why USDH

Hyperliquid's primary stable was USDC, bridged from Arbitrum. USDH is native, fully reserved (cash plus US Treasuries), and routes 50% of reserve revenue to the Assistance Fund instead of an issuer. Apps that hold or pay out stables on Hyperliquid have a reason to prefer USDH; this SDK removes the friction.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Security disclosures: [`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE)
