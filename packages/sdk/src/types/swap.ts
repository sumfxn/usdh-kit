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
  /** Estimated USDH out, smallest unit (6 decimals). */
  estimatedReceived: bigint
  /**
   * Mid-price of the on-pair orderbook, quote-token per base-token in 18 decimals.
   * For `USDH/USDC` this is USDC per USDH. See `pair`.
   */
  midPrice: bigint
  /** Pair name used to derive the quote (e.g. "USDH/USDC"). */
  pair: string
  /** Quote expiry, milliseconds since epoch. */
  validUntil: number
}
