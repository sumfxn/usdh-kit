import type { BridgeResult } from './bridge.js'

/** Stablecoins accepted as swap input on the original acquisition path. */
export type SourceStable = 'USDC' | 'USDT'

export type SwapAsset = 'USDC' | 'USDH' | 'USDT'
export type TargetStable = 'USDC' | 'USDH'

export interface SwapInput {
  /** Source stablecoin to spend. */
  from: SwapAsset
  /** Target stablecoin. Defaults to USDH for USDC/USDT input and USDC for USDH input. */
  to?: TargetStable
  /** Amount in the source token's smallest unit (6 decimals for USDH/USDC). */
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

export type RouteBlockReason =
  | 'below_min_order_value'
  | 'insufficient_hypercore_balance'
  | 'missing_evm_wallet'

export interface HypercoreBalanceInput {
  asset: TargetStable | 'USDT'
}

export interface HypercoreBalance {
  asset: TargetStable | 'USDT'
  tokenIndex: number
  decimals: number
  /** Total HyperCore balance in native token units. */
  total: bigint
  /** Balance held in open orders in native token units. */
  hold: bigint
  /** Spendable HyperCore balance (`total - hold`, floored at zero). */
  available: bigint
}

export interface SwapRoute {
  from: SwapAsset
  to: TargetStable
  amount: bigint
  sourceChain: SourceChain
  requiresBridge: boolean
  canSwap: boolean
  blockReason?: RouteBlockReason
  quote: Quote
  /** Spendable HyperCore source-token balance in HyperCore native units. */
  hypercoreBalance: bigint
  /** Total HyperCore source-token balance in HyperCore native units. */
  hypercoreTotal: bigint
  /** HyperCore source-token balance held in open orders. */
  hypercoreHold: bigint
  /** HyperCore source-token decimals. */
  hypercoreDecimals: number
  /** Required HyperCore source-token balance for a direct swap, including buffers. */
  requiredHypercoreBalance: bigint
}

export interface BridgeAndSwapInput extends RouteInput {
  /** Override the default bridge credit poll timeout (ms). Defaults to 180_000. */
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
  /** Target token received, smallest unit (6 decimals for USDH/USDC). */
  received: bigint
  /** Source token spent, smallest unit (6 decimals for USDH/USDC). */
  spent: bigint
  /** Effective fill price (quote-per-base), fixed-point 18 decimals. */
  price: bigint
  /** Realised slippage in basis points (absolute value vs mid-price). */
  slippageBps: number
}

export interface QuoteInput {
  from: SwapAsset
  to?: TargetStable
  amount: bigint
}

export interface Quote {
  from: SwapAsset
  to: TargetStable
  /** Estimated target out, smallest unit (6 decimals for USDH/USDC). */
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
