import type { BridgeResult } from './bridge.js'

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

/** Where the source stable is expected to come from. */
export type SourceChain = 'hypercore' | 'hyperevm'

export interface RouteInput extends SwapInput {
  /**
   * Source-chain preference. Defaults to `auto`: use HyperCore when the user
   * already has enough source balance there, otherwise route through the
   * HyperEVM bridge.
   */
  sourceChain?: SourceChain | 'auto'
}

export type RouteBlockReason = 'insufficient_hypercore_balance' | 'missing_evm_wallet'

export interface SwapRoute {
  from: SourceStable
  amount: bigint
  sourceChain: SourceChain
  requiresBridge: boolean
  canSwap: boolean
  blockReason?: RouteBlockReason
  quote: Quote
  /** HyperCore source-token balance in HyperCore native units. */
  hypercoreBalance: bigint
  /** HyperCore source-token decimals. */
  hypercoreDecimals: number
  /** Required HyperCore source-token balance for a direct swap, including buffers. */
  requiredHypercoreBalance: bigint
}

export interface BridgeAndSwapInput extends RouteInput {
  /** Override the default bridge credit poll timeout (ms). Defaults to 30_000. */
  waitForCreditTimeoutMs?: number
  /** Optional lifecycle callback for apps that want progress UI. */
  onProgress?: (event: BridgeAndSwapEvent) => void
}

export type BridgeAndSwapEvent =
  | { phase: 'route'; route: SwapRoute }
  | { phase: 'bridging'; route: SwapRoute }
  | { phase: 'swapping'; route: SwapRoute; bridge?: BridgeResult }
  | { phase: 'done'; route: SwapRoute; result: BridgeAndSwapResult }

export interface BridgeAndSwapResult {
  route: SwapRoute
  bridge?: BridgeResult
  swap: SwapResult
}

export interface SwapResult {
  /** Hyperliquid order id as decimal string. */
  orderId: string
  /** USDH received, smallest unit (6 decimals). */
  received: bigint
  /** Source spent, smallest unit. */
  spent: bigint
  /** Effective fill price (quote-per-base), fixed-point 18 decimals. */
  price: bigint
  /** Realised slippage in basis points (absolute value vs mid-price). */
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
