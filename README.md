# usdh-kit

`usdh-kit` is a TypeScript SDK for swapping stables into USDH on Hyperliquid.

> Status: pre-release — under active development. Public API is unstable until `1.0.0`.

## Install

```sh
pnpm add usdh-kit
```

## Quickstart

```ts
import { createUsdhKit } from 'usdh-kit'

const kit = createUsdhKit({
  network: 'mainnet',
  signer: mySigner,
})

const result = await kit.swap({
  from: 'USDC',
  amount: 1000n,
  slippageBps: 20,
})
```

## Documentation

Full documentation: [docs.usdh-kit.dev](https://docs.usdh-kit.dev) _(coming soon)_.

## Roadmap

- **V1** — `USDC | USDT → USDH` via HyperCore spot orderbook
- **V1.5** — React widget (`<USDHSwap />`) and CLI
- **V2** — HyperEVM AMM routing via CoreWriter
- **V3** — Cross-venue intelligent routing

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Security disclosures: [`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE)
