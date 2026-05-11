import type { Address, Hex } from '../types/hex.js'

export interface SpotToken {
  name: string
  szDecimals: number
  weiDecimals: number
  index: number
  tokenId: Hex
  isCanonical: boolean
  evmContract?: { address: Address; evm_extra_wei_decimals: number } | null
  fullName?: string | null
}

export interface SpotPair {
  name: string
  /** [baseTokenIndex, quoteTokenIndex] */
  tokens: [number, number]
  index: number
  isCanonical: boolean
}

export interface SpotMeta {
  universe: SpotPair[]
  tokens: SpotToken[]
}

export interface L2Level {
  /** Price as decimal string. */
  px: string
  /** Size as decimal string. */
  sz: string
  /** Number of orders at this level. */
  n: number
}

export interface L2Book {
  coin: string
  /** Server timestamp, ms since epoch. */
  time: number
  /** [bids, asks], best-first. */
  levels: [L2Level[], L2Level[]]
}

/** One row of `spotClearinghouseState.balances`. */
export interface SpotBalance {
  /** Token name (e.g. "USDC"). */
  coin: string
  /** Token id (e.g. "0x6d1e..."). */
  token: number
  /** Total balance as decimal string in HC native `weiDecimals`. */
  total: string
  /** Held in open orders, decimal string. */
  hold: string
  /** Entry notional, decimal string. */
  entryNtl: string
}

export interface SpotClearinghouseState {
  balances: SpotBalance[]
}

export interface OutcomeSideSpec {
  name: string
}

export interface OutcomeMetaOutcome {
  outcome: number
  name: string
  description: string
  sideSpecs: [OutcomeSideSpec, OutcomeSideSpec]
}

export interface OutcomeMetaQuestion {
  question: number
  name: string
  description: string
  fallbackOutcome: number
  namedOutcomes: number[]
  settledNamedOutcomes: number[]
}

export interface OutcomeMeta {
  outcomes: OutcomeMetaOutcome[]
  questions?: OutcomeMetaQuestion[]
}

/** A user's resting open order, as returned by `frontendOpenOrders`. */
export interface OpenOrder {
  /** Coin name (e.g. "USDH/USDC") or `@<spotIndex>` for non-canonical spot. */
  coin: string
  /** "B" = buy/bid, "A" = ask/sell. */
  side: 'A' | 'B'
  limitPx: string
  sz: string
  origSz: string
  oid: number
  timestamp: number
  reduceOnly: boolean
  orderType: string
  triggerCondition: string
  triggerPx: string
  isPositionTpsl: boolean
  isTrigger: boolean
}

export type OrderStatusValue =
  | 'open'
  | 'filled'
  | 'canceled'
  | 'triggered'
  | 'rejected'
  | 'marginCanceled'
  | 'vaultWithdrawalCanceled'
  | 'openInterestCapCanceled'
  | 'selfTradeCanceled'
  | 'reduceOnlyCanceled'
  | 'siblingFilledCanceled'
  | 'delistedCanceled'
  | 'liquidatedCanceled'
  | 'scheduledCancel'
  | 'tickRejected'
  | 'minTradeNtlRejected'
  | 'perpMarginRejected'
  | 'badAloPxRejected'
  | 'iocCancelRejected'
  | 'badTriggerPxRejected'
  | 'marketOrderNoLiquidityRejected'
  | 'insufficientSpotBalanceRejected'
  | 'oracleRejected'

/** Detailed order info returned by the `orderStatus` endpoint. */
export interface OrderStatusDetail {
  order: {
    coin: string
    side: 'A' | 'B'
    limitPx: string
    sz: string
    origSz: string
    oid: number
    timestamp: number
    reduceOnly: boolean
    orderType: string
    triggerCondition: string
    triggerPx: string
    isPositionTpsl: boolean
    isTrigger: boolean
  }
  status: OrderStatusValue
  statusTimestamp: number
}

export type OrderStatusResponse =
  | { status: 'order'; order: OrderStatusDetail }
  | { status: 'unknownOid' }
