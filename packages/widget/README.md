# @usdh-kit/widget

Embeddable React widget for swapping stablecoins into USDH on Hyperliquid.

> Pre-release scaffold. The functional component arrives in the next PR.

## Install

```sh
pnpm add @usdh-kit/widget @usdh-kit/sdk wagmi viem @tanstack/react-query react react-dom
```

## Usage

```tsx
import { USDHSwap } from '@usdh-kit/widget'

export default function Page() {
  return <USDHSwap network="mainnet" />
}
```

## Status

- This PR scaffolds the package: build pipeline, peer deps, placeholder component
- Next PR ports the swap UI from `apps/demo` into this package and rewires `apps/demo` to consume it
- A follow-up adds a standalone (script-tag) build target

## License

[MIT](../../LICENSE)
