# treasury-rebalance

Scheduled-job example. Reads the treasury wallet's HyperCore USDC balance, and if it sits above a configured floor, converts a fraction of the excess to USDH (Hyperliquid's native stablecoin, which routes 50% of reserves revenue to the Assistance Fund).

Designed to run on a cron (every hour, every day, etc.) so a treasury that accrues USDC over time keeps a portion productive in USDH without manual intervention.

## Run

```sh
cp .env.example .env
# edit .env: PRIV_KEY, USDC_FLOOR, REBALANCE_BPS
pnpm install
pnpm --filter @usdh-kit-examples/treasury-rebalance start
```

Run on a cron with the same env loaded (`crontab`, GitHub Actions, k8s CronJob, etc.).

## Behavior

1. Fetch the wallet's HyperCore USDC balance.
2. If `balance < USDC_FLOOR`, skip.
3. Else, swap `(balance - floor) * REBALANCE_BPS / 10000` USDC into USDH.
4. Log the swap result.

This example does NOT bridge from HyperEVM — it assumes the treasury already holds USDC on HyperCore. If you need bridging, see `node-swap`.

## Safety

- Run on testnet first.
- Use a dedicated treasury wallet, not your main one.
- Lock down env loading (no `.env` in repos, use a secrets manager in prod).
