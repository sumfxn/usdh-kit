# payment-webhook

Stripe webhook example. On every `payment_intent.succeeded`, converts the merchant treasury's USDC balance equivalent to the payment amount into USDH.

Demonstrates how to wire the kit into an event-driven backend without any web framework: native `node:http` plus the official Stripe SDK for signature verification.

## Run

```sh
cp .env.example .env
# edit .env: PRIV_KEY, STRIPE_WEBHOOK_SECRET, NETWORK
pnpm install
pnpm --filter @usdh-kit-examples/payment-webhook start
```

Then expose the port (default 4242) with a tunnel (e.g. `stripe listen --forward-to localhost:4242/webhook`) and trigger a test event.

## What it does

1. Listens on `POST /webhook`, reads the raw body.
2. Verifies the Stripe signature with `stripe.webhooks.constructEvent`.
3. On `payment_intent.succeeded`, computes a USDC equivalent (`amount_received` is in cents, USDC is in 6 decimals — multiply by 10_000) and runs `kit.swap` from the merchant wallet.
4. Returns 200 on success, 400 on signature failure, 500 on swap failure (Stripe will retry).

## Caveats

- Swap is fire-and-forget per webhook. For production, persist webhook deduplication (Stripe can deliver twice) and reconcile balances out-of-band.
- This example does NOT credit the customer with USDH on chain — that requires a `spotSend` action (out of V1 scope). Treat it as the merchant-side leg only.
- Run on testnet with Stripe test mode first.

## Safety

- Never commit `.env`.
- Use a dedicated treasury wallet, not your main one.
- Validate `event.id` against a persistent store before swapping in production.
