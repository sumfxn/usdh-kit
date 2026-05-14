import type { UsdhPair } from './discovery.js'
import { InvalidInputError } from './errors.js'
import type { OrderSide, PlaceOrderInput, Tif } from './orders.js'
import type { OutcomeSide, OutcomeSideMarket, UsdhOutcomeMarket } from './outcomes.js'
import type { L2Book } from './transport/types.js'

export type QuoteReadinessCheckKey = 'pair' | 'book' | 'spread' | 'depth'
export type QuoteReadinessBlockReason =
  | 'missing_pair'
  | 'empty_book'
  | 'crossed_book'
  | 'wide_spread'
  | 'thin_depth'

export interface QuoteReadinessCheck {
  key: QuoteReadinessCheckKey
  label: string
  ready: boolean
  value: string
  reason?: string
}

export interface QuoteReadiness {
  pair: string
  ready: boolean
  checks: QuoteReadinessCheck[]
  bestBid?: string
  bestAsk?: string
  spreadBps?: number
  depth: {
    levels: number
    bid: string
    ask: string
  }
  blockReason?: QuoteReadinessBlockReason
}

export type QuoteSummaryBlockReason =
  | QuoteReadinessBlockReason
  | 'missing_amount'
  | 'unsupported_route'

export interface QuoteReadinessPairInput {
  name: string
  base?: string
  quote?: string
  label?: string
}

export interface CreateQuoteReadinessInput {
  /** USDH pair object, pair label such as "USDH/USDC", or null while loading. */
  pair?: QuoteReadinessPairInput | UsdhPair | string | null
  /** Top-of-book read for the selected pair. Null/undefined produces an empty-book block. */
  book?: L2Book | null
  /** Maximum acceptable spread in basis points. Defaults to 50 bps. */
  maxSpreadBps?: number
  /** Minimum bid and ask side depth across the inspected top levels. */
  minSideDepth?: number | string
  /** Number of book levels to include when checking depth. Defaults to 3. */
  depthLevels?: number
}

export interface CreateQuoteSummaryDataInput extends CreateQuoteReadinessInput {
  /** User-entered pay amount as a decimal string. */
  amount?: string | null
  /** Asset the user pays, usually USDC or USDH. */
  payAsset?: string
  /** Optional expected receive asset. Used to disambiguate route direction. */
  receiveAsset?: string
  /** Decimal places for the displayed receive estimate. Defaults to 6. */
  receiveDecimals?: number
}

export interface QuoteSummaryData {
  pair: string
  ready: boolean
  readiness: QuoteReadiness
  pay: {
    asset: string
    amount: string
  }
  receive?: {
    asset: string
    amount: string
  }
  side?: OrderSide
  price?: string
  blockReason?: QuoteSummaryBlockReason
}

export type SpotOrderDraftMode = 'limit' | 'market'
export type SpotOrderDraftCheckKey =
  | 'pair'
  | 'side'
  | 'size'
  | 'price'
  | 'tif'
  | 'slippage'
  | 'notional'
  | 'balance'
  | 'readiness'
export type SpotOrderDraftBlockReason =
  | 'missing_pair'
  | 'invalid_side'
  | 'invalid_size'
  | 'below_min_size'
  | 'size_precision'
  | 'invalid_price'
  | 'price_precision'
  | 'invalid_tif'
  | 'invalid_slippage'
  | 'below_min_notional'
  | 'insufficient_balance'
  | 'quote_not_ready'

export interface SpotOrderDraftCheck {
  key: SpotOrderDraftCheckKey
  label: string
  ready: boolean
  value: string
  reason?: string
  blockReason?: SpotOrderDraftBlockReason
}

export interface CreateSpotOrderDraftInput {
  /** USDH spot pair object or label. This helper does not support HIP-4 side-coin writes. */
  pair?: QuoteReadinessPairInput | UsdhPair | string | null
  side?: OrderSide | string | null
  /** Base size as a decimal string. */
  size?: string | null
  /** Limit price. Omit for a market-order draft. */
  price?: string | null
  mode?: SpotOrderDraftMode
  tif?: Tif
  reduceOnly?: boolean
  slippageBps?: number
  minSize?: number | string
  minNotional?: number | string
  sizeDecimals?: number
  priceDecimals?: number
  availableBase?: number | string
  availableQuote?: number | string
  readiness?: QuoteReadiness | null
}

export interface SpotOrderDraft {
  pair: string
  side: OrderSide | 'missing'
  mode: SpotOrderDraftMode
  canReview: boolean
  checks: SpotOrderDraftCheck[]
  size?: string
  price?: string
  notional?: string
  placeOrderInput?: PlaceOrderInput
  blockReason?: SpotOrderDraftBlockReason
}

export type OrderTicketMode = SpotOrderDraftMode
export type OrderTicketCheckKey = SpotOrderDraftCheckKey
export type OrderTicketBlockReason = SpotOrderDraftBlockReason
export type OrderTicketCheck = SpotOrderDraftCheck
export type CreateOrderTicketDraftInput = CreateSpotOrderDraftInput
export type OrderTicketDraft = SpotOrderDraft

export interface OutcomeBookInput {
  levels: [Array<{ px: string; sz: string }>, Array<{ px: string; sz: string }>]
}

export interface OutcomeSideReadInput {
  /** Optional l2Book for the side coin, used for probability and depth. */
  book?: OutcomeBookInput | null
  /** Explicit probability override in whole percent points. */
  probability?: number | null
  bestBid?: string | null
  bestAsk?: string | null
  depth?: string | null
}

export interface OutcomeSideQuote {
  side: OutcomeSide
  label: string
  coin: `#${number}`
  tokenName: `+${number}`
  probability: number | null
  bestBid?: string
  bestAsk?: string
  depth?: string
}

export interface OutcomeEventData {
  id: number
  title: string
  subtitle: string
  description: string
  descriptionFields: Record<string, string>
  sides: [OutcomeSideQuote, OutcomeSideQuote]
}

export interface OutcomeBookRow {
  price: string
  size: string
  depthPct: number
}

export interface OutcomeOrderBookLevels {
  bids: OutcomeBookRow[]
  asks: OutcomeBookRow[]
}

export type OutcomeOrderBookBlockReason = 'empty_book' | 'crossed_book'

export interface OutcomeOrderBookSummary {
  coin: string
  ready: boolean
  levels: OutcomeOrderBookLevels
  bestBid?: string
  bestAsk?: string
  spreadBps?: number
  depth: {
    levels: number
    bid: string
    ask: string
    minSide: string
  }
  blockReason?: OutcomeOrderBookBlockReason
}

export interface CreateOutcomeMarketRowsInput {
  markets: UsdhOutcomeMarket[]
  /** Optional side reads keyed by #coin, +tokenName, encoding, or asset id. */
  readsByCoin?: Record<string, OutcomeSideReadInput | undefined>
  limit?: number
  sortBy?: 'input' | 'probability'
}

export interface CreateOutcomeSideSelectionInput {
  market: UsdhOutcomeMarket
  selected?: OutcomeSide | `#${number}` | `+${number}` | OutcomeSideMarket | null
  reads?: [OutcomeSideReadInput?, OutcomeSideReadInput?]
}

export interface OutcomeSideSelectionData {
  event: OutcomeEventData
  selectedIndex: OutcomeSide
  selectedCoin: `#${number}`
  selected: OutcomeSideQuote
}

export type OutcomePositionState = 'held' | 'watch' | 'settled' | 'redeemable'

export interface OutcomePositionData {
  market: string
  outcome: number
  side: OutcomeSide
  sideName: string
  coin: `#${number}`
  tokenName: `+${number}`
  quantity?: string
  mark?: string
  state: OutcomePositionState
}

export type OutcomePositionSideInput = number | `#${number}` | `+${number}` | OutcomeSideMarket

export interface OutcomeMarketSideResolution {
  market: UsdhOutcomeMarket
  side: OutcomeSideMarket
}

export interface OutcomePositionBalanceInput {
  /** Hyperliquid balance coin, commonly +<encoding> for HIP-4 spot balances. */
  coin?: string
  /** Hyperliquid token/asset id, matched against normalized side asset ids. */
  token?: number
  total: string
  hold?: string
}

export interface CreateOutcomePositionDataInput {
  market: UsdhOutcomeMarket
  side: OutcomeSide | `#${number}` | `+${number}` | OutcomeSideMarket
  quantity?: string
  mark?: string
  state?: OutcomePositionState
}

export interface CreateOutcomePositionDataFromSideInput {
  markets: UsdhOutcomeMarket[]
  side: OutcomePositionSideInput
  quantity?: string
  mark?: string
  state?: OutcomePositionState
}

export interface CreateOutcomePositionRowsInput {
  markets: UsdhOutcomeMarket[]
  /** spotClearinghouseState balances or equivalent account balances. */
  balances: OutcomePositionBalanceInput[]
  /** Optional marks keyed by #coin, +tokenName, encoding, or asset id. */
  marks?: Record<string, string>
  includeZero?: boolean
  state?: OutcomePositionState
}

const DEFAULT_MAX_SPREAD_BPS = 50
const DEFAULT_DEPTH_LEVELS = 3
const DEFAULT_MIN_ORDER_NOTIONAL = 10
const DECIMAL_STRING_PATTERN = /^\d+(\.\d+)?$/
const VALID_TIFS = ['Gtc', 'Ioc', 'Alo']

interface DecimalValue {
  units: bigint
  scale: number
}

/**
 * Derive a read-only quote guard from a USDH spot pair and l2Book.
 *
 * Use this near quote buttons, swap forms, and ticket headers. It never fetches,
 * signs, or submits; the parent app owns cache, refresh, wallet, and writes.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createQuoteReadiness(input: CreateQuoteReadinessInput): QuoteReadiness {
  const pair =
    input.pair === undefined || input.pair === null ? null : normalizePairLabel(input.pair)
  const depthLevels = input.depthLevels ?? DEFAULT_DEPTH_LEVELS
  const maxSpreadBps = input.maxSpreadBps ?? DEFAULT_MAX_SPREAD_BPS
  const minSideDepth = input.minSideDepth === undefined ? null : Number(input.minSideDepth)
  const bids = input.book?.levels[0] ?? []
  const asks = input.book?.levels[1] ?? []
  const bestBid = bids[0]?.px
  const bestAsk = asks[0]?.px
  const bid = bestBid === undefined ? null : Number(bestBid)
  const ask = bestAsk === undefined ? null : Number(bestAsk)
  const hasBook = bid !== null && ask !== null && Number.isFinite(bid) && Number.isFinite(ask)
  const crossed = hasBook && bid > ask
  const spreadBps = hasBook && !crossed ? calculateSpreadBps(bid, ask) : undefined
  const bidDepth = sumBookSize(bids.slice(0, depthLevels))
  const askDepth = sumBookSize(asks.slice(0, depthLevels))
  const hasDepth =
    hasBook &&
    (minSideDepth === null ||
      (!Number.isNaN(minSideDepth) && bidDepth >= minSideDepth && askDepth >= minSideDepth))

  const checks: QuoteReadinessCheck[] = [
    {
      key: 'pair',
      label: 'Pair',
      ready: pair !== null,
      value: pair ?? 'missing',
      ...(pair === null && { reason: 'No USDH pair selected.' }),
    },
    {
      key: 'book',
      label: 'Book',
      ready: hasBook && !crossed,
      value: hasBook ? `${bestBid} / ${bestAsk}` : 'missing',
      ...(!hasBook && { reason: 'Both bid and ask are required.' }),
      ...(crossed && { reason: 'Best bid is above best ask.' }),
    },
    {
      key: 'spread',
      label: 'Spread',
      ready: spreadBps !== undefined && spreadBps <= maxSpreadBps,
      value: spreadBps === undefined ? '-' : `${spreadBps.toFixed(1)} bps`,
      ...(spreadBps !== undefined &&
        spreadBps > maxSpreadBps && { reason: `Spread is above ${maxSpreadBps} bps.` }),
    },
    {
      key: 'depth',
      label: 'Depth',
      ready: hasDepth,
      value: `${formatSize(Math.min(bidDepth, askDepth))} min side`,
      ...(!hasDepth && { reason: 'Top-of-book depth is below the requested minimum.' }),
    },
  ]

  const blockReason = firstQuoteBlockReason(checks)
  return {
    pair: pair ?? 'missing',
    ready: blockReason === undefined,
    checks,
    ...(bestBid !== undefined && { bestBid }),
    ...(bestAsk !== undefined && { bestAsk }),
    ...(spreadBps !== undefined && { spreadBps }),
    depth: {
      levels: depthLevels,
      bid: formatSize(bidDepth),
      ask: formatSize(askDepth),
    },
    ...(blockReason !== undefined && { blockReason }),
  }
}

/**
 * Build a swap-summary data contract from amount, route direction, and top-of-book.
 *
 * This estimates the receive amount from the current best bid/ask and carries
 * the full readiness object so UI can block unsafe quote states.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createQuoteSummaryData(input: CreateQuoteSummaryDataInput): QuoteSummaryData {
  const readiness = createQuoteReadiness(input)
  const amount = input.amount === undefined || input.amount === null ? null : input.amount
  const amountValue = readPositiveDecimal(amount)
  const pairAssets = readPairAssets(input.pair)
  const route = resolveQuoteRoute(pairAssets, input.payAsset, input.receiveAsset)
  const price = route?.side === 'buy' ? readiness.bestAsk : readiness.bestBid
  const priceValue = readPositiveDecimal(price)
  const receiveAmount =
    amountValue !== null && route !== null && priceValue !== null
      ? route.side === 'buy'
        ? divideDecimalsToString(amountValue, priceValue, input.receiveDecimals ?? 6)
        : multiplyDecimalsToString(amountValue, priceValue, input.receiveDecimals ?? 6)
      : null
  const blockReason: QuoteSummaryBlockReason | undefined =
    amountValue === null
      ? 'missing_amount'
      : route === null
        ? 'unsupported_route'
        : !readiness.ready
          ? readiness.blockReason
          : undefined

  return {
    pair: readiness.pair,
    ready: blockReason === undefined,
    readiness,
    pay: {
      asset: route?.payAsset ?? input.payAsset ?? pairAssets?.quote ?? 'unknown',
      amount: amount === null ? 'missing' : cleanDecimalString(amount),
    },
    ...(route !== null &&
      receiveAmount !== null && {
        receive: {
          asset: route.receiveAsset,
          amount: receiveAmount,
        },
      }),
    ...(route !== null && { side: route.side }),
    ...(price !== undefined && { price }),
    ...(blockReason !== undefined && { blockReason }),
  }
}

/**
 * Validate an unsigned USDH spot order draft and return signer-ready input.
 *
 * This helper is intentionally draft-only: it does not sign, submit, or call
 * /exchange. HIP-4 side-coin trading writes are outside this release scope.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createSpotOrderDraft(input: CreateSpotOrderDraftInput): SpotOrderDraft {
  const mode =
    input.mode ?? (input.price === undefined || input.price === null ? 'market' : 'limit')
  const pair =
    input.pair === undefined || input.pair === null ? null : normalizePairLabel(input.pair)
  const side = normalizeOrderSide(input.side)
  const sizeValue = readPositiveDecimal(input.size)
  const priceValue = readPositiveDecimal(input.price)
  const sizeDecimalCount =
    input.size === undefined || input.size === null ? null : countDecimals(input.size)
  const priceDecimalCount =
    input.price === undefined || input.price === null ? null : countDecimals(input.price)
  const minSize = readNonNegativeDecimal(input.minSize ?? 0)
  const impliedPrice = impliedTicketPrice(side, input.readiness)
  const notionalPrice = priceValue ?? impliedPrice
  const notional =
    sizeValue !== null && notionalPrice !== null ? multiplyDecimals(sizeValue, notionalPrice) : null
  const minNotional = readPositiveDecimal(input.minNotional ?? DEFAULT_MIN_ORDER_NOTIONAL)
  const sizeReady = sizeValue !== null
  const sizeReason =
    sizeValue === null
      ? 'Size must be a positive decimal string.'
      : minSize !== null && compareDecimals(sizeValue, minSize) < 0
        ? `Size is below ${formatNotional(minSize)}.`
        : input.sizeDecimals !== undefined &&
            sizeDecimalCount !== null &&
            sizeDecimalCount > input.sizeDecimals
          ? `Size has more than ${input.sizeDecimals} decimals.`
          : undefined
  const priceReason =
    mode === 'limit' && priceValue === null
      ? 'Limit price must be a positive decimal string.'
      : mode === 'limit' &&
          input.priceDecimals !== undefined &&
          priceDecimalCount !== null &&
          priceDecimalCount > input.priceDecimals
        ? `Price has more than ${input.priceDecimals} decimals.`
        : undefined
  const tifReason = ticketTifReason(mode, input.tif)
  const slippageReason = ticketSlippageReason(mode, input.slippageBps)
  const notionalReady =
    notional === null || minNotional === null || compareDecimals(notional, minNotional) >= 0
  const balanceReason = ticketBalanceReason({
    side,
    size: sizeValue,
    notional,
    availableBase: input.availableBase,
    availableQuote: input.availableQuote,
  })
  const readinessReady =
    input.readiness === undefined || input.readiness === null || input.readiness.ready
  const checks: SpotOrderDraftCheck[] = [
    {
      key: 'pair',
      label: 'Pair',
      ready: pair !== null,
      value: pair ?? 'missing',
      ...(pair === null && {
        reason: 'Select a USDH-bearing pair before review.',
        blockReason: 'missing_pair' as const,
      }),
    },
    {
      key: 'side',
      label: 'Side',
      ready: side !== null,
      value: side ?? 'missing',
      ...(side === null && {
        reason: `Side must be 'buy' or 'sell'.`,
        blockReason: 'invalid_side' as const,
      }),
    },
    {
      key: 'size',
      label: 'Size',
      ready: sizeReady && sizeReason === undefined,
      value: input.size ?? 'missing',
      ...(sizeReason !== undefined && {
        reason: sizeReason,
        blockReason:
          sizeValue === null
            ? ('invalid_size' as const)
            : minSize !== null && compareDecimals(sizeValue, minSize) < 0
              ? ('below_min_size' as const)
              : ('size_precision' as const),
      }),
    },
    {
      key: 'price',
      label: mode === 'limit' ? 'Limit price' : 'Market price',
      ready: priceReason === undefined,
      value: mode === 'market' ? 'derived at submit' : (input.price ?? 'missing'),
      ...(priceReason !== undefined && {
        reason: priceReason,
        blockReason:
          priceValue === null ? ('invalid_price' as const) : ('price_precision' as const),
      }),
    },
    {
      key: 'tif',
      label: 'TIF',
      ready: tifReason === undefined,
      value: input.tif ?? (mode === 'market' ? 'Ioc' : 'Gtc'),
      ...(tifReason !== undefined && {
        reason: tifReason,
        blockReason: 'invalid_tif' as const,
      }),
    },
    {
      key: 'slippage',
      label: 'Slippage',
      ready: slippageReason === undefined,
      value: input.slippageBps === undefined ? 'default' : `${input.slippageBps} bps`,
      ...(slippageReason !== undefined && {
        reason: slippageReason,
        blockReason: 'invalid_slippage' as const,
      }),
    },
    {
      key: 'notional',
      label: 'Notional',
      ready: notionalReady,
      value: notional === null ? 'estimated at submit' : formatNotional(notional),
      ...(!notionalReady && {
        reason: `Notional is below ${formatNotional(minNotional ?? DEFAULT_MIN_ORDER_NOTIONAL)}.`,
        blockReason: 'below_min_notional' as const,
      }),
    },
    {
      key: 'balance',
      label: 'Balance',
      ready: balanceReason === undefined,
      value: balanceValue(side, input.availableBase, input.availableQuote),
      ...(balanceReason !== undefined && {
        reason: balanceReason,
        blockReason: 'insufficient_balance' as const,
      }),
    },
    {
      key: 'readiness',
      label: 'Quote guard',
      ready: readinessReady,
      value:
        input.readiness === undefined || input.readiness === null
          ? 'not provided'
          : input.readiness.pair,
      ...(!readinessReady && {
        reason: 'Quote readiness is blocked.',
        blockReason: 'quote_not_ready' as const,
      }),
    },
  ]
  const blockReason = firstSpotOrderBlockReason(checks)
  const canReview = blockReason === undefined
  const placeOrderInput =
    canReview && pair !== null && side !== null && sizeValue !== null
      ? createPlaceOrderInput(input, pair, side, mode)
      : undefined

  return {
    pair: pair ?? 'missing',
    side: side ?? 'missing',
    mode,
    canReview,
    checks,
    ...(input.size !== undefined &&
      input.size !== null && { size: cleanDecimalString(input.size) }),
    ...(mode === 'limit' &&
      input.price !== undefined &&
      input.price !== null && { price: cleanDecimalString(input.price) }),
    ...(notional !== null && { notional: formatNotional(notional) }),
    ...(placeOrderInput !== undefined && { placeOrderInput }),
    ...(blockReason !== undefined && { blockReason }),
  }
}

export const createOrderTicketDraft = createSpotOrderDraft

/**
 * Map a normalized HIP-4 market plus optional side reads into event-card data.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createOutcomeEventData(
  market: UsdhOutcomeMarket,
  reads: [OutcomeSideReadInput?, OutcomeSideReadInput?] = [],
): OutcomeEventData {
  return {
    id: market.outcome,
    title: market.name,
    subtitle: market.sides.map((side) => side.name).join(' / '),
    description: market.description,
    descriptionFields: market.descriptionFields,
    sides: [
      createOutcomeSideQuote(market.sides[0], reads[0]),
      createOutcomeSideQuote(market.sides[1], reads[1]),
    ],
  }
}

/**
 * Map one normalized HIP-4 side and optional book/read data into an odds quote.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createOutcomeSideQuote(
  side: OutcomeSideMarket,
  read: OutcomeSideReadInput = {},
): OutcomeSideQuote {
  const bestBid = read.bestBid ?? read.book?.levels[0]?.[0]?.px
  const bestAsk = read.bestAsk ?? read.book?.levels[1]?.[0]?.px
  const probability =
    read.probability ??
    probabilityFromBook({
      ...(bestBid !== undefined && bestBid !== null && { bestBid }),
      ...(bestAsk !== undefined && bestAsk !== null && { bestAsk }),
    })
  const depth =
    read.depth ?? (read.book ? formatSize(sumBookSize(read.book.levels.flat())) : undefined)
  return {
    side: side.side,
    label: side.name,
    coin: side.coin,
    tokenName: side.tokenName,
    probability,
    ...(bestBid !== undefined && bestBid !== null && { bestBid }),
    ...(bestAsk !== undefined && bestAsk !== null && { bestAsk }),
    ...(depth !== undefined && depth !== null && { depth }),
  }
}

/**
 * Normalize a side-coin l2Book into bid/ask rows with depth percentages.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createOutcomeOrderBookLevels(
  book: OutcomeBookInput,
  options?: { levels?: number },
): OutcomeOrderBookLevels {
  const levels = options?.levels ?? 6
  const rows = [...book.levels[0].slice(0, levels), ...book.levels[1].slice(0, levels)]
  const maxSize = Math.max(0, ...rows.map((row) => Number(row.sz)))
  return {
    bids: book.levels[0].slice(0, levels).map((row) => toOutcomeBookRow(row, maxSize)),
    asks: book.levels[1].slice(0, levels).map((row) => toOutcomeBookRow(row, maxSize)),
  }
}

/**
 * Build read-only book health for one HIP-4 side coin.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createOutcomeOrderBookSummary(
  book: OutcomeBookInput & { coin?: string },
  options?: { levels?: number },
): OutcomeOrderBookSummary {
  const levels = options?.levels ?? 6
  const bids = book.levels[0]
  const asks = book.levels[1]
  const bestBid = bids[0]?.px
  const bestAsk = asks[0]?.px
  const bid = readNonNegativeNumber(bestBid)
  const ask = readNonNegativeNumber(bestAsk)
  const hasBook = bid !== null && ask !== null
  const crossed = hasBook && bid > ask
  const spreadBps = hasBook && !crossed ? calculateSpreadBps(bid, ask) : undefined
  const bidDepth = sumBookSize(bids.slice(0, levels))
  const askDepth = sumBookSize(asks.slice(0, levels))
  const blockReason: OutcomeOrderBookBlockReason | undefined = !hasBook
    ? 'empty_book'
    : crossed
      ? 'crossed_book'
      : undefined

  return {
    coin: book.coin ?? 'unknown',
    ready: blockReason === undefined,
    levels: createOutcomeOrderBookLevels(book, { levels }),
    ...(bestBid !== undefined && { bestBid }),
    ...(bestAsk !== undefined && { bestAsk }),
    ...(spreadBps !== undefined && { spreadBps }),
    depth: {
      levels,
      bid: formatSize(bidDepth),
      ask: formatSize(askDepth),
      minSide: formatSize(Math.min(bidDepth, askDepth)),
    },
    ...(blockReason !== undefined && { blockReason }),
  }
}

/**
 * Build market-list rows from normalized HIP-4 metadata and optional side reads.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createOutcomeMarketRows(input: CreateOutcomeMarketRowsInput): OutcomeEventData[] {
  const rows = input.markets.map((market) => {
    const reads: [OutcomeSideReadInput?, OutcomeSideReadInput?] = []
    const first = readOutcomeSideInput(input.readsByCoin, market.sides[0])
    const second = readOutcomeSideInput(input.readsByCoin, market.sides[1])
    if (first !== undefined) reads[0] = first
    if (second !== undefined) reads[1] = second
    return createOutcomeEventData(market, reads)
  })
  const sorted =
    input.sortBy === 'probability'
      ? [...rows].sort((left, right) => topProbability(right) - topProbability(left))
      : rows
  return input.limit === undefined ? sorted : sorted.slice(0, input.limit)
}

/**
 * Resolve a controlled selected side coin and return both the event and side data.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createOutcomeSideSelection(
  input: CreateOutcomeSideSelectionInput,
): OutcomeSideSelectionData {
  const selectedSide = resolveOutcomeSide(input.market, input.selected ?? input.market.sides[0])
  const event = createOutcomeEventData(input.market, input.reads)
  const selected = event.sides[selectedSide.side]
  return {
    event,
    selectedIndex: selectedSide.side,
    selectedCoin: selectedSide.coin,
    selected,
  }
}

/**
 * Resolve one HIP-4 side reference into a readable portfolio/watchlist row.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createOutcomePositionData(
  input: CreateOutcomePositionDataInput,
): OutcomePositionData {
  const side = resolveOutcomeSide(input.market, input.side)
  return {
    market: input.market.name,
    outcome: input.market.outcome,
    side: side.side,
    sideName: side.name,
    coin: side.coin,
    tokenName: side.tokenName,
    ...(input.quantity !== undefined && { quantity: input.quantity }),
    ...(input.mark !== undefined && { mark: input.mark }),
    state: input.state ?? 'held',
  }
}

/**
 * Resolve a side coin/token across a market list into one position row.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createOutcomePositionDataFromSide(
  input: CreateOutcomePositionDataFromSideInput,
): OutcomePositionData {
  const resolved = resolveOutcomeMarketSide(input.markets, input.side)
  return createOutcomePositionData({
    market: resolved.market,
    side: resolved.side,
    ...(input.quantity !== undefined && { quantity: input.quantity }),
    ...(input.mark !== undefined && { mark: input.mark }),
    ...(input.state !== undefined && { state: input.state }),
  })
}

/**
 * Convert wallet balances into readable HIP-4 position rows.
 *
 * Balances are matched by +tokenName, #coin, encoding, or asset id. Quantity is
 * computed as total - hold using decimal-string arithmetic to avoid float drift.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function createOutcomePositionRows(
  input: CreateOutcomePositionRowsInput,
): OutcomePositionData[] {
  const rows: OutcomePositionData[] = []
  for (const balance of input.balances) {
    const resolved = findOutcomeMarketSideFromBalance(input.markets, balance)
    if (resolved === null) continue
    const quantity = subtractDecimalStrings(balance.total, balance.hold ?? '0')
    if (!input.includeZero && isZeroDecimalString(quantity)) continue
    const mark = readOutcomeMark(input.marks, resolved.side)
    rows.push(
      createOutcomePositionData({
        market: resolved.market,
        side: resolved.side,
        quantity,
        ...(mark !== undefined && { mark }),
        state: input.state ?? 'held',
      }),
    )
  }
  return rows
}

/**
 * Find a HIP-4 side in a market list without throwing.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function findOutcomeMarketSide(
  markets: UsdhOutcomeMarket[],
  side: OutcomePositionSideInput,
): OutcomeMarketSideResolution | null {
  const ref = normalizeOutcomePositionSideRef(side)
  for (const market of markets) {
    const found = market.sides.find(
      (candidate) =>
        candidate.coin === ref ||
        candidate.tokenName === ref ||
        candidate.encoding === ref ||
        candidate.assetId === ref,
    )
    if (found !== undefined) return { market, side: found }
  }
  return null
}

/**
 * Find a HIP-4 side in a market list or throw InvalidInputError.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function resolveOutcomeMarketSide(
  markets: UsdhOutcomeMarket[],
  side: OutcomePositionSideInput,
): OutcomeMarketSideResolution {
  const resolved = findOutcomeMarketSide(markets, side)
  if (resolved === null) {
    throw new InvalidInputError(
      `outcome side ${String(normalizeOutcomePositionSideRef(side))} was not found`,
    )
  }
  return resolved
}

/**
 * Resolve a HIP-4 side from a spot balance coin/token without throwing.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function findOutcomeMarketSideFromBalance(
  markets: UsdhOutcomeMarket[],
  balance: OutcomePositionBalanceInput,
): OutcomeMarketSideResolution | null {
  for (const ref of outcomeSideRefsFromBalance(balance)) {
    const resolved = findOutcomeMarketSide(markets, ref)
    if (resolved !== null) return resolved
  }
  return null
}

/**
 * Resolve a side index, #coin, +tokenName, or side object within one market.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function resolveOutcomeSide(
  market: UsdhOutcomeMarket,
  side: OutcomeSide | `#${number}` | `+${number}` | OutcomeSideMarket,
): OutcomeSideMarket {
  if (typeof side === 'object') return side
  const found =
    typeof side === 'number'
      ? market.sides[side]
      : market.sides.find((candidate) => candidate.coin === side || candidate.tokenName === side)
  if (found === undefined) {
    throw new InvalidInputError(
      `outcome side ${String(side)} was not found for outcome ${market.outcome}`,
    )
  }
  return found
}

/**
 * Estimate whole-percent probability from best bid/ask or a side-coin l2Book.
 *
 * @experimental Builder helper API is pre-release until `1.0.0`.
 */
export function probabilityFromBook(
  input: OutcomeBookInput | { bestBid?: string | null; bestAsk?: string | null },
): number | null {
  const bestBid = 'levels' in input ? input.levels[0][0]?.px : input.bestBid
  const bestAsk = 'levels' in input ? input.levels[1][0]?.px : input.bestAsk
  const bid = bestBid === undefined || bestBid === null ? Number.NaN : Number(bestBid)
  const ask = bestAsk === undefined || bestAsk === null ? Number.NaN : Number(bestAsk)
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid < 0 || ask < 0 || bid > ask) {
    return null
  }
  return Math.min(99, Math.max(1, Math.round(((bid + ask) / 2) * 100)))
}

function normalizeOutcomePositionSideRef(
  side: OutcomePositionSideInput,
): `#${number}` | `+${number}` | number {
  if (typeof side === 'object') return side.coin
  return side
}

function outcomeSideRefsFromBalance(
  balance: OutcomePositionBalanceInput,
): OutcomePositionSideInput[] {
  const refs: OutcomePositionSideInput[] = []
  if (balance.coin?.startsWith('#') || balance.coin?.startsWith('+')) {
    refs.push(balance.coin as `#${number}` | `+${number}`)
  }
  if (balance.token !== undefined) {
    refs.push(balance.token)
  }
  return refs
}

function readOutcomeMark(
  marks: Record<string, string> | undefined,
  side: OutcomeSideMarket,
): string | undefined {
  if (marks === undefined) return undefined
  return (
    marks[side.coin] ??
    marks[side.tokenName] ??
    marks[String(side.encoding)] ??
    marks[String(side.assetId)]
  )
}

function readOutcomeSideInput(
  reads: Record<string, OutcomeSideReadInput | undefined> | undefined,
  side: OutcomeSideMarket,
): OutcomeSideReadInput | undefined {
  if (reads === undefined) return undefined
  return (
    reads[side.coin] ??
    reads[side.tokenName] ??
    reads[String(side.encoding)] ??
    reads[String(side.assetId)]
  )
}

function topProbability(event: OutcomeEventData): number {
  return Math.max(...event.sides.map((side) => side.probability ?? -1))
}

function subtractDecimalStrings(total: string, hold: string): string {
  const totalClean = cleanDecimalString(total)
  const holdClean = cleanDecimalString(hold)
  if (!DECIMAL_STRING_PATTERN.test(totalClean) || !DECIMAL_STRING_PATTERN.test(holdClean)) {
    return '0'
  }
  const scale = Math.max(countDecimals(totalClean), countDecimals(holdClean))
  const diff = parseFixedDecimal(totalClean, scale) - parseFixedDecimal(holdClean, scale)
  return formatFixedDecimal(diff > 0n ? diff : 0n, scale)
}

function isZeroDecimalString(value: string): boolean {
  return readNonNegativeNumber(value) === 0
}

function parseFixedDecimal(value: string, scale: number): bigint {
  const [intPart = '0', fracPart = ''] = value.split('.')
  return BigInt(`${intPart}${fracPart.padEnd(scale, '0')}`)
}

function formatFixedDecimal(value: bigint, scale: number): string {
  if (value === 0n) return '0'
  if (scale === 0) return value.toString()
  const padded = value.toString().padStart(scale + 1, '0')
  const whole = padded.slice(0, -scale)
  const fraction = padded.slice(-scale).replace(/0+$/, '')
  return fraction === '' ? whole : `${whole}.${fraction}`
}

function normalizePairLabel(pair: QuoteReadinessPairInput | UsdhPair | string): string {
  if (typeof pair === 'string') return pair
  if ('label' in pair && pair.label) return pair.label
  if ('base' in pair && 'quote' in pair && pair.base && pair.quote)
    return `${pair.base}/${pair.quote}`
  return pair.name
}

function readPairAssets(
  pair: QuoteReadinessPairInput | UsdhPair | string | null | undefined,
): { base: string; quote: string } | null {
  if (pair === undefined || pair === null) return null
  if (typeof pair === 'string') return parsePairAssets(pair)
  if ('base' in pair && 'quote' in pair && pair.base && pair.quote) {
    return { base: pair.base, quote: pair.quote }
  }
  return parsePairAssets(pair.name)
}

function parsePairAssets(pair: string): { base: string; quote: string } | null {
  const [base, quote, extra] = pair.split('/')
  if (base === undefined || quote === undefined || extra !== undefined) return null
  if (base === '' || quote === '') return null
  return { base, quote }
}

function resolveQuoteRoute(
  pair: { base: string; quote: string } | null,
  payAsset: string | undefined,
  receiveAsset: string | undefined,
): {
  payAsset: string
  receiveAsset: string
  side: OrderSide
} | null {
  if (pair === null) return null
  const pay = payAsset === undefined ? undefined : normalizeAssetName(payAsset)
  const receive = receiveAsset === undefined ? undefined : normalizeAssetName(receiveAsset)
  const base = normalizeAssetName(pair.base)
  const quote = normalizeAssetName(pair.quote)

  if (pay !== undefined && receive !== undefined) {
    if (pay === quote && receive === base) {
      return { payAsset: pair.quote, receiveAsset: pair.base, side: 'buy' }
    }
    if (pay === base && receive === quote) {
      return { payAsset: pair.base, receiveAsset: pair.quote, side: 'sell' }
    }
    return null
  }
  if (pay !== undefined) {
    if (pay === quote) return { payAsset: pair.quote, receiveAsset: pair.base, side: 'buy' }
    if (pay === base) return { payAsset: pair.base, receiveAsset: pair.quote, side: 'sell' }
    return null
  }
  if (receive !== undefined) {
    if (receive === base) return { payAsset: pair.quote, receiveAsset: pair.base, side: 'buy' }
    if (receive === quote) return { payAsset: pair.base, receiveAsset: pair.quote, side: 'sell' }
  }
  return null
}

function normalizeAssetName(asset: string): string {
  return asset.trim().toUpperCase()
}

function normalizeOrderSide(side: OrderSide | string | null | undefined): OrderSide | null {
  if (side === 'buy' || side === 'sell') return side
  return null
}

function readPositiveDecimal(value: number | string | null | undefined): DecimalValue | null {
  if (value === undefined || value === null) return null
  const parsed = readDecimal(value)
  return parsed !== null && parsed.units > 0n ? parsed : null
}

function readNonNegativeDecimal(value: number | string | null | undefined): DecimalValue | null {
  if (value === undefined || value === null) return null
  const parsed = readDecimal(value)
  return parsed !== null && parsed.units >= 0n ? parsed : null
}

function readDecimal(value: number | string): DecimalValue | null {
  const cleaned = cleanDecimalString(String(value))
  if (!DECIMAL_STRING_PATTERN.test(cleaned)) return null
  const [whole = '0', fraction = ''] = cleaned.split('.')
  const scale = fraction.length
  return {
    units: BigInt(`${whole}${fraction}`),
    scale,
  }
}

function readNonNegativeNumber(value: number | string | null | undefined): number | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && !DECIMAL_STRING_PATTERN.test(cleanDecimalString(value))) {
    return null
  }
  const parsed = typeof value === 'number' ? value : Number(cleanDecimalString(value))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function cleanDecimalString(value: string): string {
  return value.trim().replace(/,/g, '')
}

function compareDecimals(left: DecimalValue, right: DecimalValue): -1 | 0 | 1 {
  const scale = Math.max(left.scale, right.scale)
  const leftUnits = scaleDecimalUnits(left, scale)
  const rightUnits = scaleDecimalUnits(right, scale)
  if (leftUnits < rightUnits) return -1
  if (leftUnits > rightUnits) return 1
  return 0
}

function multiplyDecimals(left: DecimalValue, right: DecimalValue): DecimalValue {
  return {
    units: left.units * right.units,
    scale: left.scale + right.scale,
  }
}

function multiplyDecimalsToString(
  left: DecimalValue,
  right: DecimalValue,
  decimals: number,
): string {
  return formatDecimal(roundDecimal(multiplyDecimals(left, right), decimals))
}

function divideDecimalsToString(
  numerator: DecimalValue,
  denominator: DecimalValue,
  decimals: number,
): string {
  if (denominator.units <= 0n) return '-'
  const scale = Math.max(0, decimals)
  const dividend = numerator.units * pow10(denominator.scale + scale)
  const divisor = denominator.units * pow10(numerator.scale)
  const quotient = roundQuotient(dividend, divisor)
  return formatDecimal({ units: quotient, scale })
}

function roundDecimal(value: DecimalValue, decimals: number): DecimalValue {
  const scale = Math.max(0, decimals)
  if (value.scale <= scale) {
    return { units: value.units * pow10(scale - value.scale), scale }
  }
  const divisor = pow10(value.scale - scale)
  return {
    units: roundQuotient(value.units, divisor),
    scale,
  }
}

function roundQuotient(dividend: bigint, divisor: bigint): bigint {
  const quotient = dividend / divisor
  const remainder = dividend % divisor
  return remainder * 2n >= divisor ? quotient + 1n : quotient
}

function scaleDecimalUnits(value: DecimalValue, scale: number): bigint {
  return value.units * pow10(scale - value.scale)
}

function pow10(exponent: number): bigint {
  if (exponent <= 0) return 1n
  return 10n ** BigInt(exponent)
}

function formatDecimal(value: DecimalValue): string {
  const negative = value.units < 0n
  const units = negative ? -value.units : value.units
  const raw = units.toString().padStart(value.scale + 1, '0')
  const whole = value.scale === 0 ? raw : raw.slice(0, -value.scale)
  const fraction = value.scale === 0 ? '' : raw.slice(-value.scale).replace(/0+$/, '')
  const formatted = fraction.length > 0 ? `${whole}.${fraction}` : whole
  return negative ? `-${formatted}` : formatted
}

function countDecimals(value: string): number {
  const cleaned = cleanDecimalString(value)
  if (!DECIMAL_STRING_PATTERN.test(cleaned)) return Number.POSITIVE_INFINITY
  return cleaned.split('.')[1]?.length ?? 0
}

function ticketTifReason(mode: SpotOrderDraftMode, tif: Tif | undefined): string | undefined {
  if (tif === undefined) return undefined
  if (!VALID_TIFS.includes(tif)) return `TIF must be 'Gtc', 'Ioc', or 'Alo'.`
  if (mode === 'market' && tif !== 'Ioc') return 'Market order drafts force TIF to Ioc.'
  return undefined
}

function ticketSlippageReason(
  mode: SpotOrderDraftMode,
  slippageBps: number | undefined,
): string | undefined {
  if (slippageBps === undefined) return undefined
  if (
    !Number.isFinite(slippageBps) ||
    !Number.isInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > 10_000
  ) {
    return 'Slippage must be an integer in [0, 10000] bps.'
  }
  if (mode !== 'market') return 'Slippage only applies to market order drafts.'
  return undefined
}

function ticketBalanceReason({
  side,
  size,
  notional,
  availableBase,
  availableQuote,
}: {
  side: OrderSide | null
  size: DecimalValue | null
  notional: DecimalValue | null
  availableBase: number | string | undefined
  availableQuote: number | string | undefined
}): string | undefined {
  if (side === 'sell' && availableBase !== undefined && size !== null) {
    const balance = readNonNegativeDecimal(availableBase)
    if (balance !== null && compareDecimals(balance, size) < 0) {
      return 'Base balance is below draft size.'
    }
  }
  if (side === 'buy' && availableQuote !== undefined && notional !== null) {
    const balance = readNonNegativeDecimal(availableQuote)
    if (balance !== null && compareDecimals(balance, notional) < 0) {
      return 'Quote balance is below draft notional.'
    }
  }
  return undefined
}

function balanceValue(
  side: OrderSide | null,
  availableBase: number | string | undefined,
  availableQuote: number | string | undefined,
): string {
  if (side === 'sell' && availableBase !== undefined) return String(availableBase)
  if (side === 'buy' && availableQuote !== undefined) return String(availableQuote)
  return 'not provided'
}

function impliedTicketPrice(
  side: OrderSide | null,
  readiness: QuoteReadiness | null | undefined,
): DecimalValue | null {
  if (side === null || readiness === undefined || readiness === null) return null
  const price = side === 'buy' ? readiness.bestAsk : readiness.bestBid
  return readPositiveDecimal(price)
}

function formatNotional(value: DecimalValue | number): string {
  const decimal = typeof value === 'number' ? readNonNegativeDecimal(value) : value
  if (decimal === null) return '-'
  return formatDecimal(roundDecimal(decimal, decimal.units >= 100n * pow10(decimal.scale) ? 0 : 2))
}

function createPlaceOrderInput(
  input: CreateSpotOrderDraftInput,
  pair: string,
  side: OrderSide,
  mode: SpotOrderDraftMode,
): PlaceOrderInput {
  return {
    pair,
    side,
    size: cleanDecimalString(input.size as string),
    ...(mode === 'limit' &&
      input.price !== undefined &&
      input.price !== null && { price: cleanDecimalString(input.price) }),
    ...(mode === 'limit' && input.tif !== undefined && { tif: input.tif }),
    ...(input.reduceOnly !== undefined && { reduceOnly: input.reduceOnly }),
    ...(mode === 'market' && input.slippageBps !== undefined && { slippageBps: input.slippageBps }),
  }
}

function calculateSpreadBps(bid: number, ask: number): number {
  const mid = (bid + ask) / 2
  if (mid <= 0) return Number.POSITIVE_INFINITY
  return ((ask - bid) / mid) * 10_000
}

function sumBookSize(rows: Array<{ sz: string }>): number {
  return rows.reduce((total, row) => {
    const next = Number(row.sz.replace(/,/g, ''))
    return Number.isFinite(next) ? total + next : total
  }, 0)
}

function formatSize(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value >= 1_000_000) return `${trimNumber(value / 1_000_000)}m`
  if (value >= 1_000) return `${trimNumber(value / 1_000)}k`
  return trimNumber(value)
}

function trimNumber(value: number): string {
  return value
    .toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}

function firstQuoteBlockReason(
  checks: QuoteReadinessCheck[],
): QuoteReadinessBlockReason | undefined {
  const failed = checks.find((check) => !check.ready)
  if (failed?.key === 'pair') return 'missing_pair'
  if (failed?.key === 'book')
    return failed.reason?.includes('above') ? 'crossed_book' : 'empty_book'
  if (failed?.key === 'spread') return 'wide_spread'
  if (failed?.key === 'depth') return 'thin_depth'
  return undefined
}

function firstSpotOrderBlockReason(
  checks: SpotOrderDraftCheck[],
): SpotOrderDraftBlockReason | undefined {
  const failed = checks.find((check) => !check.ready)
  return failed?.blockReason
}

function toOutcomeBookRow(row: { px: string; sz: string }, maxSize: number): OutcomeBookRow {
  const size = Number(row.sz)
  const depthPct =
    maxSize > 0 && Number.isFinite(size) ? Math.max(1, Math.round((size / maxSize) * 100)) : 0
  return {
    price: row.px,
    size: row.sz,
    depthPct,
  }
}
