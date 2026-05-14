import {
  type OutcomeSide,
  type OutcomeSideMarket,
  type UsdhOutcomeMarket,
  createOutcomeOrderBookSummary,
  createOutcomeEventData as createSdkOutcomeEventData,
  createOutcomePositionData as createSdkOutcomePositionData,
  createOutcomeSideQuote as createSdkOutcomeSideQuote,
} from '@usdh-kit/sdk'

import type { GalleryOutcome } from '../../../lib/gallery-data'
import type {
  OutcomeBookRow,
  OutcomeEventData,
  OutcomeOrderBookSideLevels,
  OutcomePositionData,
  OutcomeSideQuote,
} from './outcomes'

export interface OutcomePatternSideInput {
  label: string
  coin: string
}

export interface OutcomePatternMarketInput {
  id: number | string
  title: string
  subtitle?: string
  sides: [OutcomePatternSideInput, OutcomePatternSideInput]
}

export interface OutcomePatternReadInput {
  probability?: number | null
  bestBid?: string | null
  bestAsk?: string | null
  depth?: string | null
}

export interface OutcomePatternPositionInput {
  market: string
  side: string
  coin: string
  shares?: string
  mark?: string
  state?: OutcomePositionData['state']
}

export interface L2BookLike {
  levels: [Array<{ px: string; sz: string }>, Array<{ px: string; sz: string }>]
}

export function createOutcomeEventData(
  market: OutcomePatternMarketInput,
  reads: [OutcomePatternReadInput?, OutcomePatternReadInput?] = [],
): OutcomeEventData {
  const event = createSdkOutcomeEventData(toSdkOutcomeMarket(market), reads)
  return {
    id: event.id,
    title: event.title,
    subtitle: market.subtitle ?? event.subtitle,
    sides: event.sides,
  }
}

export function createOutcomeSideQuote(
  side: OutcomePatternSideInput,
  read: OutcomePatternReadInput = {},
): OutcomeSideQuote {
  const quote = createSdkOutcomeSideQuote(toSdkOutcomeSideMarket(side, 0, 0), read)
  return {
    label: quote.label,
    coin: quote.coin,
    probability: quote.probability,
    bestBid: quote.bestBid,
    bestAsk: quote.bestAsk,
    depth: quote.depth,
  }
}

export function createOutcomeOrderBookLevels(book: L2BookLike): OutcomeOrderBookSideLevels {
  const levels = createOutcomeOrderBookSummary(book).levels
  return {
    bids: levels.bids.map(toOutcomeBookRow),
    asks: levels.asks.map(toOutcomeBookRow),
  }
}

export function outcomeEventWithoutLiquidity(event: OutcomeEventData): OutcomeEventData {
  return {
    ...event,
    sides: event.sides.map((side) => ({
      ...side,
      probability: null,
      bestBid: undefined,
      bestAsk: undefined,
      depth: '$0',
    })) as OutcomeEventData['sides'],
  }
}

export function createOutcomePositionData(
  position: OutcomePatternPositionInput,
): OutcomePositionData {
  const state = position.state ?? 'held'
  const market = toSdkOutcomeMarket({
    id: 20,
    title: position.market,
    sides: [
      { label: position.side, coin: position.coin },
      { label: position.side === 'Yes' ? 'No' : 'Other', coin: nextOutcomeCoin(position.coin) },
    ],
  })
  const sdkPosition = createSdkOutcomePositionData({
    market,
    side: market.sides[0],
    ...(position.shares !== undefined && { quantity: position.shares }),
    ...(position.mark !== undefined && { mark: position.mark }),
    state,
  })
  return {
    market: sdkPosition.market,
    side: sdkPosition.sideName,
    coin: sdkPosition.coin,
    position: position.shares
      ? `${sdkPosition.quantity} ${sdkPosition.sideName}`
      : positionLabel(state, sdkPosition.sideName),
    mark: sdkPosition.mark ?? markLabel(state, 0),
    state,
  }
}

export function galleryOutcomeToEventData(outcome: GalleryOutcome): OutcomeEventData {
  return createOutcomeEventData(
    {
      id: outcome.id,
      title: formatOutcomeTitle(outcome),
      subtitle: outcome.sides.join(' / '),
      sides: [
        { label: outcome.sideReads[0].side, coin: outcome.sideReads[0].coin },
        { label: outcome.sideReads[1].side, coin: outcome.sideReads[1].coin },
      ],
    },
    [outcome.sideReads[0], outcome.sideReads[1]],
  )
}

export function galleryOutcomeToLevelsByCoin(
  outcome: GalleryOutcome,
  sideIndex: 0 | 1 = 0,
): Record<string, OutcomeOrderBookSideLevels> {
  const read = outcome.sideReads[sideIndex]
  if (read === undefined) return {}
  return {
    [read.coin]: createOutcomeOrderBookLevels(bookFromSideRead(read)),
  }
}

export function galleryOutcomesToPositionData(
  outcomes: GalleryOutcome[],
  options?: { state?: OutcomePositionData['state'] },
): OutcomePositionData[] {
  return outcomes.slice(0, 4).map((outcome, index) => {
    const read = outcome.sideReads[index % 2] ?? outcome.sideReads[0]
    const side = read?.side ?? 'Yes'
    const state = options?.state ?? (index === 0 ? 'held' : 'watch')
    return createOutcomePositionData({
      market: formatOutcomeTitle(outcome),
      side,
      coin: read?.coin ?? '#200',
      mark: markLabel(state, read?.probability ?? 50),
      state,
    })
  })
}

function toSdkOutcomeMarket(market: OutcomePatternMarketInput): UsdhOutcomeMarket {
  const outcome = typeof market.id === 'number' ? market.id : Number(market.id)
  const normalizedOutcome = Number.isSafeInteger(outcome) && outcome >= 0 ? outcome : 0
  return {
    outcome: normalizedOutcome,
    name: market.title,
    description: '',
    descriptionFields: {},
    sides: [
      toSdkOutcomeSideMarket(market.sides[0], normalizedOutcome, 0),
      toSdkOutcomeSideMarket(market.sides[1], normalizedOutcome, 1),
    ],
  }
}

function toSdkOutcomeSideMarket(
  side: OutcomePatternSideInput,
  outcome: number,
  sideIndex: OutcomeSide,
): OutcomeSideMarket {
  const encoding = outcomeEncodingFromCoin(side.coin) ?? 10 * outcome + sideIndex
  return {
    side: sideIndex,
    name: side.label,
    encoding,
    coin: `#${encoding}`,
    tokenName: `+${encoding}`,
    assetId: 100_000_000 + encoding,
  }
}

function outcomeEncodingFromCoin(coin: string): number | null {
  if (!coin.startsWith('#') && !coin.startsWith('+')) return null
  const value = Number(coin.slice(1))
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function nextOutcomeCoin(coin: string): `#${number}` {
  const encoding = outcomeEncodingFromCoin(coin)
  return `#${encoding === null ? 201 : encoding + 1}`
}

function toOutcomeBookRow(row: { price: string; size: string; depthPct: number }): OutcomeBookRow {
  return {
    price: row.price,
    size: compactSize(row.size),
    depthPct: row.depthPct,
  }
}

function bookFromSideRead(read: GalleryOutcome['sideReads'][number]): L2BookLike {
  const depth = readDepthNumber(read.depth)
  const bid = Number(read.bestBid)
  const ask = Number(read.bestAsk)
  const safeBid = Number.isFinite(bid) ? bid : 0.01
  const safeAsk = Number.isFinite(ask) ? ask : 0.99
  return {
    levels: [
      [0, 1, 2].map((index) => ({
        px: Math.max(0.01, safeBid - index * 0.01).toFixed(2),
        sz: String(Math.max(1, Math.round(depth / (index + 2)))),
      })),
      [0, 1, 2].map((index) => ({
        px: Math.min(0.99, safeAsk + index * 0.01).toFixed(2),
        sz: String(Math.max(1, Math.round(depth / (index + 3)))),
      })),
    ],
  }
}

function readDepthNumber(depth: string): number {
  const value = depth.replace(/[$,\s]/g, '').toLowerCase()
  const multiplier = value.endsWith('m') ? 1_000_000 : value.endsWith('k') ? 1_000 : 1
  const parsed = Number(value.replace(/[mk]$/, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed * multiplier : 1_000
}

function compactSize(value: string) {
  const parsed = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(parsed)) return value
  if (parsed >= 1_000_000) return `${(parsed / 1_000_000).toFixed(1)}m`
  if (parsed >= 1_000) return `${(parsed / 1_000).toFixed(1)}k`
  return parsed.toFixed(0)
}

function positionLabel(state: OutcomePositionData['state'], side: string) {
  if (state === 'redeemable') return `125.0 ${side}`
  if (state === 'settled') return `0.0 ${side}`
  if (state === 'held') return `125.0 ${side}`
  return 'watching'
}

function markLabel(state: OutcomePositionData['state'], probability: number) {
  if (state === 'redeemable') return 'Won'
  if (state === 'settled') return 'Final'
  return `${probability}%`
}

function formatOutcomeTitle(outcome: GalleryOutcome) {
  if (/^recurring/i.test(outcome.name) || /^binary market/i.test(outcome.name)) {
    return fallbackOutcomeTitle(outcome.id)
  }
  return outcome.name
}

function fallbackOutcomeTitle(id: number) {
  const examples = [
    'USDH weekly volume clears $5m',
    'HYPE weekly close green',
    'Protocol fee vote passes',
  ]
  return examples[Math.abs(id) % examples.length] ?? `Outcome market #${id}`
}
