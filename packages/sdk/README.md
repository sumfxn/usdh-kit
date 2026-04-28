# usdh-kit

TypeScript SDK to swap stablecoins (USDC, USDT) into USDH on Hyperliquid.

Pre-release. `swap()` and `getQuote()` throw `NotImplementedError` until execution lands.

## Install

```sh
pnpm add usdh-kit
```

## Usage

```ts
import { createUsdhKit, SlippageExceededError } from 'usdh-kit'

const kit = createUsdhKit({ network: 'mainnet', signer })

try {
  const result = await kit.swap({ from: 'USDC', amount: 1_000_000n })
  console.log(`got ${result.received} USDH`)
} catch (err) {
  if (err instanceof SlippageExceededError) {
    // handle
  }
}
```

## License

[MIT](../../LICENSE)
