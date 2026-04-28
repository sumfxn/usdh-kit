/**
 * Scheduled treasury rebalance: convert a fraction of HyperCore USDC above
 * a floor into USDH. Designed to run on a cron.
 *
 * Reads `spotClearinghouseState` directly via the HL info endpoint to avoid
 * pulling extra deps. The kit's own balance helper is internal; we rebuild
 * the small piece we need so the example stays self-contained.
 */
import { config } from 'dotenv'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { type Signer, createUsdhKit } from '@usdh-kit/sdk'

config()

const PRIV_KEY = process.env['PRIV_KEY'] as Hex | undefined
const NETWORK = (process.env['NETWORK'] ?? 'testnet') as 'mainnet' | 'testnet'
const USDC_FLOOR = BigInt(process.env['USDC_FLOOR'] ?? '1000000000')
const REBALANCE_BPS = Number(process.env['REBALANCE_BPS'] ?? '5000')

if (!PRIV_KEY || PRIV_KEY === '0x') {
  console.error('Missing PRIV_KEY in .env. Copy .env.example and fill it in.')
  process.exit(1)
}
if (!Number.isFinite(REBALANCE_BPS) || REBALANCE_BPS < 0 || REBALANCE_BPS > 10_000) {
  console.error('REBALANCE_BPS must be between 0 and 10000.')
  process.exit(1)
}

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
    debug: (event, ctx) => console.log(`[debug] ${event}`, ctx ?? ''),
    info: (event, ctx) => console.log(`[info ] ${event}`, ctx ?? ''),
    warn: (event, ctx) => console.warn(`[warn ] ${event}`, ctx ?? ''),
    error: (event, ctx) => console.error(`[error] ${event}`, ctx ?? ''),
  },
})

const INFO_URL =
  NETWORK === 'mainnet'
    ? 'https://api.hyperliquid.xyz/info'
    : 'https://api.hyperliquid-testnet.xyz/info'

interface SpotBalanceRow {
  coin: string
  token: number
  total: string
  hold: string
  entryNtl: string
}

async function fetchUsdcBalanceEvmUnits(): Promise<bigint> {
  const res = await fetch(INFO_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'spotClearinghouseState', user: account.address }),
  })
  if (!res.ok) throw new Error(`HL ${res.status}`)
  const data = (await res.json()) as { balances?: SpotBalanceRow[] }
  const usdc = data.balances?.find((b) => b.token === 0)
  if (!usdc) return 0n
  // HC USDC has weiDecimals=8 but EVM has 6 → divide by 100 to surface user-facing units.
  const [intPart, fracPart = ''] = usdc.total.split('.')
  const padded = fracPart.padEnd(8, '0').slice(0, 8)
  const hcWei = BigInt(intPart + padded)
  return hcWei / 100n
}

async function main() {
  console.log(`account:        ${account.address}`)
  console.log(`network:        ${NETWORK}`)
  console.log(`floor:          ${USDC_FLOOR} (USDC smallest unit, 6 dec)`)
  console.log(`rebalanceBps:   ${REBALANCE_BPS}`)

  const balance = await fetchUsdcBalanceEvmUnits()
  console.log(`\nHC USDC balance (6-dec equiv): ${balance}`)

  if (balance <= USDC_FLOOR) {
    console.log(`Below floor (${USDC_FLOOR}). Nothing to do.`)
    return
  }

  const excess = balance - USDC_FLOOR
  const swapAmount = (excess * BigInt(REBALANCE_BPS)) / 10_000n
  if (swapAmount === 0n) {
    console.log('Computed swap amount is 0. Skipping.')
    return
  }

  console.log(`\n→ swap ${swapAmount} USDC → USDH`)
  const result = await kit.swap({ from: 'USDC', amount: swapAmount })
  console.log(`  orderId:     ${result.orderId}`)
  console.log(`  received:    ${result.received} USDH`)
  console.log(`  spent:       ${result.spent} USDC`)
  console.log(`  slippageBps: ${result.slippageBps}`)
}

main().catch((err) => {
  console.error('\nrebalance failed:', err)
  process.exit(1)
})
