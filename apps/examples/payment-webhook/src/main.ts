import { createServer } from 'node:http'
/**
 * Stripe webhook receiver. On `payment_intent.succeeded`, converts the
 * USDC equivalent of the payment into USDH from the merchant wallet.
 *
 * Native node:http server (no framework) + official Stripe SDK for
 * signature verification.
 */
import { config } from 'dotenv'
import Stripe from 'stripe'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { type Signer, createUsdhKit } from '@usdh-kit/sdk'

config()

const PRIV_KEY = process.env['PRIV_KEY'] as Hex | undefined
const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET']
const NETWORK = (process.env['NETWORK'] ?? 'testnet') as 'mainnet' | 'testnet'
const PORT = Number(process.env['PORT'] ?? '4242')

if (!PRIV_KEY || PRIV_KEY === '0x') {
  console.error('Missing PRIV_KEY in .env. Copy .env.example and fill it in.')
  process.exit(1)
}
if (!STRIPE_WEBHOOK_SECRET || !STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
  console.error('Missing or invalid STRIPE_WEBHOOK_SECRET in .env.')
  process.exit(1)
}

const stripe = new Stripe('sk_dummy_unused_for_webhook_verification', {
  apiVersion: '2024-12-18.acacia',
})
const account = privateKeyToAccount(PRIV_KEY)
const signer: Signer = {
  address: account.address,
  // biome-ignore lint/suspicious/noExplicitAny: viem typed-data variance
  signTypedData: (args) => account.signTypedData(args as any),
  signMessage: (message) =>
    account.signMessage({
      message: typeof message === 'string' ? message : { raw: message },
    }),
}
const kit = createUsdhKit({
  network: NETWORK,
  signer,
  slippageBps: 30,
  logger: {
    debug: () => {},
    info: (event, ctx) => console.log(`[info ] ${event}`, ctx ?? ''),
    warn: (event, ctx) => console.warn(`[warn ] ${event}`, ctx ?? ''),
    error: (event, ctx) => console.error(`[error] ${event}`, ctx ?? ''),
  },
})

async function readRawBody(req: import('node:http').IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }
  return Buffer.concat(chunks)
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  const amountReceived = intent.amount_received ?? intent.amount
  // Stripe amounts are in the currency's smallest unit (cents for USD).
  // USDC has 6 decimals → multiply cents by 10_000.
  const usdcAmount = BigInt(amountReceived) * 10_000n
  if (usdcAmount === 0n) {
    console.log(`[skip ] payment_intent ${intent.id}: amount is zero`)
    return
  }
  console.log(`[swap ] payment_intent ${intent.id}: converting ${usdcAmount} USDC -> USDH`)
  const result = await kit.swap({ from: 'USDC', amount: usdcAmount })
  console.log(`[swap ] filled oid=${result.orderId} received=${result.received} USDH`)
}

const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.statusCode = 404
    res.end()
    return
  }
  const sig = req.headers['stripe-signature']
  if (typeof sig !== 'string') {
    res.statusCode = 400
    res.end('missing stripe-signature header')
    return
  }
  let event: Stripe.Event
  try {
    const raw = await readRawBody(req)
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET as string)
  } catch (err) {
    console.error('signature verification failed:', err)
    res.statusCode = 400
    res.end('invalid signature')
    return
  }

  if (event.type === 'payment_intent.succeeded') {
    try {
      await handlePaymentSucceeded(event.data.object)
    } catch (err) {
      console.error('swap failed:', err)
      res.statusCode = 500
      res.end('swap failed')
      return
    }
  } else {
    console.log(`[skip ] ${event.type}`)
  }

  res.statusCode = 200
  res.end('ok')
})

server.listen(PORT, () => {
  console.log(`payment-webhook listening on :${PORT}/webhook`)
  console.log(`merchant wallet: ${account.address} (${NETWORK})`)
  console.log(`tip: stripe listen --forward-to localhost:${PORT}/webhook`)
})
