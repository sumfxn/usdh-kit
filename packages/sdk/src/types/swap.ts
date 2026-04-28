import type { Hex } from './hex.js'

/** Stablecoins accepted as swap input. */
export type SourceStable = 'USDC' | 'USDT'

export interface SwapInput {
  /** Source stablecoin to spend. */
  from: SourceStable
  /** Amount in the source token's smallest unit (6 decimals). */
  amount: bigint
  /** Override the kit's default `slippageBps` for this call. */
  slippageBps?: number
}

export interface SwapResult {
  /** Hyperliquid order/fill identifier. */
  orderId: string
  /** Hex transaction-id-equivalent for the HL action submission. */
  txHash: Hex
  /** USDH received, smallest unit (6 decimals). */
  received: bigint
  /** Source spent, smallest unit. */
  spent: bigint
  /** Effective fill price as USDH per source, fixed-point 18 decimals. */
  price: bigint
  /** Realised slippage in basis points. */
  slippageBps: number
}

export interface QuoteInput {
  from: SourceStable
  amount: bigint
}

export interface Quote {
  /** Estimated USDH out, smallest unit. */
  estimatedReceived: bigint
  /** Mid-price snapshot, fixed-point 18 decimals. */
  midPrice: bigint
  /** Quote expiry, milliseconds since epoch. */
  validUntil: number
}
