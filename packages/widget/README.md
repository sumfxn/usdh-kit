# @usdh-kit/widget

Embeddable React widget for swapping stablecoins into USDH on Hyperliquid.

## Install

```sh
pnpm add @usdh-kit/widget @usdh-kit/sdk wagmi viem @tanstack/react-query react react-dom
```

## Usage

The widget reads the connected wallet from wagmi. Wrap your tree in `WagmiProvider` and `QueryClientProvider` (e.g. via ConnectKit or RainbowKit) before rendering it.

```tsx
import { USDHSwap } from '@usdh-kit/widget'

export default function Page() {
  return <USDHSwap network="mainnet" />
}
```

The hook is exposed too, for composing custom UIs:

```tsx
import { useUsdhKit } from '@usdh-kit/widget'

function CustomSwap() {
  const kit = useUsdhKit('mainnet')
  if (!kit) return null
  // call kit.getQuote, kit.bridgeToCore, kit.swap directly
}
```

## Styling

The component ships with Tailwind utility classes inline. Your project must run Tailwind for these to render. A standalone CSS bundle (no Tailwind required) lands in a follow-up.

## Props

```ts
type USDHSwapProps = {
  network?: 'mainnet' | 'testnet' // defaults to 'mainnet'
}
```

## License

[MIT](../../LICENSE)
