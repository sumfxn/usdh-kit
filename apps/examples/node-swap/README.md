# node-swap

Minimal Node script that bridges USDC from HyperEVM to HyperCore, then swaps USDC into USDH.

Useful as a copy-paste integration starting point and as the testnet harness for validating SDK changes against real HL endpoints.

## Run

```sh
cp .env.example .env
# edit .env: set PRIV_KEY, choose NETWORK
pnpm install
pnpm --filter @usdh-kit-examples/node-swap start
```

## Prerequisites

- A HyperEVM-funded wallet (testnet HYPE for gas + test USDC on HyperEVM).
- Testnet faucets and contract addresses come from the Hyperliquid docs.
- For mainnet runs: real funds, do a tiny dry-run first.

## Safety

- Never commit `.env`. The `.gitignore` excludes it.
- Use a dedicated wallet, not your main one.
- Start with `AMOUNT_USDC_EVM=1000000` (1 USDC) until you trust the flow.

## What it does

1. Builds a viem `LocalAccount` from `PRIV_KEY`.
2. Adapts it to the kit's `Signer` + `EvmWallet` interfaces.
3. Calls `getQuote`, `bridgeToCore`, `swap` and logs every step.

The full adapter is ~12 lines; copy `src/main.ts` into your own backend as a starting point.
