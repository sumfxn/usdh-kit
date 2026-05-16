# usdh-kit

[![CI](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sumfxn/usdh-kit/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-000000.svg)](./LICENSE)

![usdh-kit banner](./docs/assets/usdh-banner.svg)

<!--
  npm-dependent badges, intentionally commented until @usdh-kit/sdk and
  @usdh-kit/widget are published. Uncomment only as part of an approved npm
  publish PR.

  [![@usdh-kit/sdk](https://img.shields.io/npm/v/@usdh-kit/sdk?style=flat&color=000000&label=%40usdh-kit%2Fsdk)](https://www.npmjs.com/package/@usdh-kit/sdk)
  [![@usdh-kit/widget](https://img.shields.io/npm/v/@usdh-kit/widget?style=flat&color=000000&label=%40usdh-kit%2Fwidget)](https://www.npmjs.com/package/@usdh-kit/widget)
  [![Downloads](https://img.shields.io/npm/dm/@usdh-kit/sdk?style=flat&color=000000)](https://www.npmjs.com/package/@usdh-kit/sdk)
  [![Bundle](https://img.shields.io/bundlephobia/minzip/@usdh-kit/sdk?style=flat&color=000000&label=sdk%20gzipped)](https://bundlephobia.com/package/@usdh-kit/sdk)
-->

USDH sunset migration kit for Hyperliquid.

USDH is being sunset in favour of USDC. The final purpose of `usdh-kit` is to
help users migrate remaining HyperCore USDH balances back to USDC, while keeping
the original USDH integration work available as legacy reference code.

- **Source:** [github.com/sumfxn/usdh-kit](https://github.com/sumfxn/usdh-kit)
- **Issues:** [github.com/sumfxn/usdh-kit/issues](https://github.com/sumfxn/usdh-kit/issues)
- **USDH:** [usdh.com](https://usdh.com) (issued by [Bridge](https://bridge.xyz), designed by [Native Markets](https://www.nativemarkets.com))
- **Hyperliquid:** [hyperliquid.xyz](https://hyperliquid.xyz) / [docs](https://hyperliquid.gitbook.io/hyperliquid-docs)

## Status

Pre-release. Public API is unstable until `1.0.0`.

This repo is in sunset/migration mode:

- `@usdh-kit/widget` exports `USDHMigration`, a wallet-gated `USDH -> USDC` exit widget.
- `@usdh-kit/sdk` keeps the USDH quote, swap, bridge, and signing helpers needed for migration.
- `USDHSwap` and `bridgeAndSwap()` remain available only as legacy compatibility surfaces.
- HIP-4 and outcome helpers remain historical/read-only reference work, not the future product surface.
- Future USDC or HIP-4 tooling should live in a separate repo/package with a clean name and API.
- No release, merge, or npm publish is implied without explicit approval.

## Migration Widget

```tsx
// app/layout.tsx
import '@usdh-kit/widget/styles.css'

// app/page.tsx
import { USDHMigration } from '@usdh-kit/widget'

export default function Page() {
  return <USDHMigration network="mainnet" />
}
```

The migration widget:

- reads the connected wallet through wagmi;
- shows the user's HyperCore USDH balance;
- reads the live `USDH/USDC` book before wallet writes;
- never fakes a `1:1` receive estimate when the quote is unavailable;
- asks for a short-lived Hyperliquid trading session before submitting the `USDH -> USDC` order;
- does not bridge the resulting USDC out to HyperEVM.

## SDK Migration Flow

```ts
import { approveAgent, createUsdhKit } from '@usdh-kit/sdk'

await approveAgent({
  network: 'mainnet',
  signer: masterWalletSigner,
  agentAddress: agentSigner.address,
  agentName: 'my-app-usdh',
  signatureChainId: 999,
})

const kit = createUsdhKit({
  network: 'mainnet',
  signer: agentSigner,
  accountAddress: masterWalletSigner.address,
  evmWallet,
  slippageBps: 30,
})

const amount = 11_000_000n // 11 USDH; Hyperliquid spot orders must be >10 USDH

const quote = await kit.getQuote({ from: 'USDH', to: 'USDC', amount })
console.log(`would receive ~${quote.estimatedReceived} USDC`)

const result = await kit.swap({ from: 'USDH', to: 'USDC', amount })
console.log(`got ${result.received} USDC for ${result.spent} USDH`)
```

`swap()` submits an IOC limit order priced from the current mid. The sunset path
sells `USDH -> USDC` down to `mid - slippageBps`. Legacy `USDC -> USDH`
acquisition remains in the package for existing integrators, but it is no longer
the migration path.

## Packages

```sh
pnpm add @usdh-kit/sdk
pnpm add @usdh-kit/widget wagmi viem @tanstack/react-query react react-dom
```

## Archive Contents

The repo also preserves the original USDH work:

- HyperCore/HyperEVM balance and bridge helpers;
- USDH spot pair discovery;
- Hyperliquid agent-wallet signing;
- legacy `USDC -> USDH` swap and bridge flows;
- experimental read-only HIP-4/outcome helpers;
- a demo registry for migration and historical component references.

Those surfaces are kept for compatibility and reference. They are not a roadmap
for turning `usdh-kit` into a USDC, generic spot, or HIP-4 SDK.

## Docs

- [docs/README.md](./docs/README.md) - docs index
- [docs/architecture.md](./docs/architecture.md) - SDK internals and legacy architecture
- [docs/agent-wallets.md](./docs/agent-wallets.md) - secure signing patterns
- [docs/bridge-and-swap.md](./docs/bridge-and-swap.md) - legacy acquisition flow and migration notes
- [docs/glossary.md](./docs/glossary.md) - Hyperliquid terms used in the repo
- [docs/roadmap.md](./docs/roadmap.md) - sunset roadmap and non-goals
- [docs/theming.md](./docs/theming.md) - widget CSS variables and theming
- [docs/troubleshooting.md](./docs/troubleshooting.md) - common errors and recovery notes

## Runtime Support

- Node.js >= 18.18
- Bun >= 1.1
- Modern evergreen browsers
- Edge runtimes with `fetch`, `AbortController`, and `bigint`

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Security disclosures:
[`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE)
