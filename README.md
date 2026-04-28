# usdh-kit

TypeScript SDK to swap stablecoins (USDC, USDT) into USDH on Hyperliquid.

Pre-release. Public API is unstable until `1.0.0`.

## Install

```sh
pnpm add usdh-kit
```

## Usage

```ts
import { createUsdhKit } from 'usdh-kit'

const kit = createUsdhKit({ network: 'mainnet', signer })

const result = await kit.swap({
  from: 'USDC',
  amount: 1_000_000n,
  slippageBps: 20,
})
```

## Roadmap

- V1: `USDC | USDT -> USDH` via HyperCore spot orderbook.
- V1.5: React widget and CLI.
- V2: HyperEVM AMM routing.
- V3: Cross-venue intelligent routing.

## License

[MIT](./LICENSE)
