# @usdh-kit/widget

Embeddable React widget for swapping stablecoins into USDH on Hyperliquid.

## Install

```sh
pnpm add @usdh-kit/widget wagmi viem @tanstack/react-query react react-dom
```

`@usdh-kit/sdk` is bundled as the widget's runtime dependency. Install the SDK
separately only when your app imports SDK APIs directly.

## Usage

The widget reads the connected wallet from wagmi. Wrap your tree in `WagmiProvider` and `QueryClientProvider` (e.g. via ConnectKit or RainbowKit) before rendering it.

The root widget entry is ESM-only because the React wallet stack it composes is ESM-first. CommonJS projects can still load `@usdh-kit/widget/styles.css` and `@usdh-kit/widget/tailwind-content`, but should import the widget from an ESM module or through their app bundler.

```tsx
import { USDHSwap } from '@usdh-kit/widget'
import '@usdh-kit/widget/styles.css'

export default function Page() {
  return <USDHSwap network="mainnet" />
}
```

The full widget manages a short-lived Hyperliquid agent wallet session before swapping. For custom UIs, prefer the SDK primitives (`approveAgent`, `accountAddress`, and `createUsdhKit`) so reads use the master wallet while L1 orders are signed by an approved agent.

For HyperEVM-funded swaps, users should expect:

1. one wallet signature to enable the trading session on first use
2. one USDC approval transaction if allowance is not already sufficient
3. one USDC deposit transaction into HyperCore
4. no wallet popup for the final USDH order; the approved session agent signs it

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
  hideNetworkToggle?: boolean
  hideAttribution?: boolean
  theme?: 'dark' | 'light' | 'auto'
  defaultSlippageBps?: number
  defaultAmount?: string
  onSwapComplete?: (result: {
    orderId: string
    receivedUsdh: bigint
    txHash?: `0x${string}`
  }) => void
}
```

`network` is required. Pass `'mainnet'` for production swaps and `'testnet'` for the Hyperliquid testnet.

## License

[MIT](../../LICENSE)
