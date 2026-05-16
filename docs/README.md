# usdh-kit

USDH sunset migration kit for Hyperliquid.

`usdh-kit` helps apps migrate remaining HyperCore USDH balances back to USDC.
The original SDK, widget, and HIP-4 work stays in the repo as legacy reference
code, not as an active product roadmap.

## Packages

| Package | Purpose |
|---|---|
| `@usdh-kit/sdk` | USDH quote, route, bridge, signing, and migration helpers kept for sunset support. |
| `@usdh-kit/widget` | Embeddable React migration widget plus the legacy swap widget. |

## What works today

* Migrate `USDH -> USDC` on the canonical Hyperliquid spot pair.
* Keep legacy `USDC -> USDH` quote and swap support for existing integrations.
* Preserve bridge, discovery, and HIP-4 read-only helpers as archive/reference surfaces.
* Use approved Hyperliquid agent wallets so browser apps do not ask Rabby or other injected wallets to sign L1 order payloads directly.
* Display HyperEVM and HyperCore balances for USDC and USDH in the widget.

## Quick install

```sh
pnpm add @usdh-kit/sdk
```

For the widget:

```sh
pnpm add @usdh-kit/widget wagmi viem @tanstack/react-query react react-dom
```

The widget depends on `@usdh-kit/sdk` internally. Install the SDK separately
only when your app imports SDK APIs directly.

## Minimal widget

```tsx
import { USDHMigration } from '@usdh-kit/widget'
import '@usdh-kit/widget/styles.css'

export default function Page() {
  return <USDHMigration network="mainnet" />
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

const result = await kit.swap({
  from: 'USDH',
  to: 'USDC',
  amount: 11_000_000n,
})

console.log(result.orderId)
```

## Read next

* [Bridge and swap flow](bridge-and-swap.md) explains the legacy acquisition journey and Rabby prompts.
* [Agent wallets](agent-wallets.md) explains secure signing patterns for builders.
* [Architecture](architecture.md) documents the SDK internals.
