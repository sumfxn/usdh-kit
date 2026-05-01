# usdh-kit

TypeScript SDK and React widget for USDH on Hyperliquid.

`usdh-kit` helps apps convert USDC into USDH without reimplementing Hyperliquid spot routing, EIP-712 order signing, HyperEVM bridge transactions, or bridge-credit polling.

## Packages

| Package | Purpose |
|---|---|
| `@usdh-kit/sdk` | Quote, route, bridge, and swap `USDC -> USDH`. |
| `@usdh-kit/widget` | Embeddable React swap widget built on the SDK. |

## What works today

* Quote and swap `USDC -> USDH` on the canonical Hyperliquid spot pair.
* Route from existing HyperCore USDC when available.
* Bridge USDC from HyperEVM to HyperCore, wait for credit, then swap.
* Use approved Hyperliquid agent wallets so browser apps do not ask Rabby or other injected wallets to sign L1 order payloads directly.
* Display HyperEVM and HyperCore balances for USDC and USDH in the widget.

## Quick install

```sh
pnpm add @usdh-kit/sdk
```

For the widget:

```sh
pnpm add @usdh-kit/widget @usdh-kit/sdk wagmi viem @tanstack/react-query react react-dom
```

## Minimal widget

```tsx
import { USDHSwap } from '@usdh-kit/widget'
import '@usdh-kit/widget/styles.css'

export default function Page() {
  return <USDHSwap network="mainnet" />
}
```

## Minimal SDK flow

```ts
import { approveAgent, createUsdhKit } from '@usdh-kit/sdk'

await approveAgent({
  network: 'mainnet',
  signer: masterSigner,
  agentAddress: agentSigner.address,
  agentName: 'my-app-usdh',
  signatureChainId: 999,
})

const kit = createUsdhKit({
  network: 'mainnet',
  signer: agentSigner,
  accountAddress: masterSigner.address,
  evmWallet: masterEvmWallet,
  slippageBps: 30,
})

const result = await kit.bridgeAndSwap({
  from: 'USDC',
  amount: 11_000_000n,
  onProgress: (event) => console.log(event.phase),
})

console.log(result.swap.orderId)
```

## Read next

* [Bridge and swap flow](bridge-and-swap.md) explains the full user journey and Rabby prompts.
* [Agent wallets](agent-wallets.md) explains secure signing patterns for builders.
* [Architecture](architecture.md) documents the SDK internals.
