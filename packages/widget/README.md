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

Pick one of the two paths depending on whether your app already runs Tailwind.

### Already using Tailwind v3

Spread the widget's content paths into your Tailwind config so its utility classes are scanned and emitted alongside your own:

```ts
// tailwind.config.ts
import widgetContent from '@usdh-kit/widget/tailwind-content'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', ...widgetContent],
}

export default config
```

Tailwind v3 does not deep-merge `content` arrays from presets, which is why we ship paths as a plain array instead of a preset object.

### Not using Tailwind

Import the pre-compiled stylesheet once at your app entry. It's about 3 KB and contains only the utility classes the widget renders.

```ts
import '@usdh-kit/widget/styles.css'
```

## Props

```ts
type USDHSwapProps = {
  network: 'mainnet' | 'testnet'
}
```

`network` is required. Pass `'mainnet'` for production swaps and `'testnet'` for the Hyperliquid testnet.

## License

[MIT](../../LICENSE)
