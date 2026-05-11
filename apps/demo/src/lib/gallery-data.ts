import {
  type L2Book,
  type UsdhOutcomeMarket,
  type UsdhPair,
  createInfoClient,
  listUsdhSpotPairs,
  normalizeOutcomeMeta,
} from '@usdh-kit/sdk'

export type GalleryDataMode = 'live' | 'sample'

export interface GalleryPair {
  name: string
  label: string
  index: number
  role: 'base' | 'quote'
  mid: string
}

export interface GalleryOutcome {
  id: number
  name: string
  sides: [string, string]
  coin: string
}

export interface GalleryBookLevel {
  price: string
  size: string
  orders: number
}

export interface GalleryBook {
  coin: string
  bids: GalleryBookLevel[]
  asks: GalleryBookLevel[]
}

export interface GallerySnapshot {
  mode: GalleryDataMode
  generatedAt: string
  pairs: GalleryPair[]
  outcomes: GalleryOutcome[]
  book: GalleryBook
  notes: string[]
}

const SAMPLE_SNAPSHOT: GallerySnapshot = {
  mode: 'sample',
  generatedAt: new Date(0).toISOString(),
  pairs: [
    { name: '@230', label: 'USDH/USDC', index: 230, role: 'base', mid: '1.0002' },
    { name: '@232', label: 'HYPE/USDH', index: 232, role: 'quote', mid: '42.18' },
    { name: '@235', label: 'PURR/USDH', index: 235, role: 'quote', mid: '0.183' },
  ],
  outcomes: [
    { id: 20, name: 'Binary outcome market', sides: ['Yes', 'No'], coin: '#200' },
    { id: 24, name: 'USDH-denominated event', sides: ['Up', 'Down'], coin: '#240' },
  ],
  book: {
    coin: '@230',
    bids: [
      { price: '0.9999', size: '17,420', orders: 8 },
      { price: '0.9998', size: '11,080', orders: 5 },
      { price: '0.9997', size: '8,260', orders: 4 },
    ],
    asks: [
      { price: '1.0001', size: '14,880', orders: 7 },
      { price: '1.0002', size: '9,510', orders: 4 },
      { price: '1.0003', size: '7,300', orders: 3 },
    ],
  },
  notes: ['sample fallback', 'read-only only'],
}

export async function loadGallerySnapshot(): Promise<GallerySnapshot> {
  try {
    const info = createInfoClient({ network: 'mainnet', timeoutMs: 3_500 })
    const [spotMeta, mids] = await Promise.all([info.spotMeta(), info.allMids()])
    const pairs = listUsdhSpotPairs(spotMeta)
    if (pairs.length === 0) return sampleNow(['no live USDH pairs returned'])

    const primaryPair =
      pairs.find((pair) => pair.base === 'USDH' && pair.quote === 'USDC') ?? pairs[0]
    if (primaryPair === undefined) return sampleNow(['no primary USDH pair returned'])

    const [bookResult, outcomesResult] = await Promise.allSettled([
      info.l2Book(primaryPair.name),
      info.outcomeMeta(),
    ])

    const liveOutcomes =
      outcomesResult.status === 'fulfilled'
        ? toGalleryOutcomes(normalizeOutcomeMeta(outcomesResult.value)).slice(0, 3)
        : SAMPLE_SNAPSHOT.outcomes

    return {
      mode: 'live',
      generatedAt: new Date().toISOString(),
      pairs: pairs.slice(0, 5).map((pair) => toGalleryPair(pair, mids)),
      outcomes: liveOutcomes.length > 0 ? liveOutcomes : SAMPLE_SNAPSHOT.outcomes,
      book:
        bookResult.status === 'fulfilled'
          ? toGalleryBook(bookResult.value)
          : { ...SAMPLE_SNAPSHOT.book, coin: primaryPair.name },
      notes: [
        'mainnet read-only',
        outcomesResult.status === 'fulfilled' ? 'outcomes live' : 'outcomes sample',
        bookResult.status === 'fulfilled' ? 'book live' : 'book sample',
      ],
    }
  } catch (err) {
    return sampleNow([err instanceof Error ? err.message : 'live data unavailable'])
  }
}

function sampleNow(notes: string[]): GallerySnapshot {
  return {
    ...SAMPLE_SNAPSHOT,
    generatedAt: new Date().toISOString(),
    notes: ['sample fallback', ...notes.slice(0, 2)],
  }
}

function toGalleryPair(pair: UsdhPair, mids: Record<string, string>): GalleryPair {
  return {
    name: pair.name,
    label: `${pair.base}/${pair.quote}`,
    index: pair.index,
    role: pair.usdhRole,
    mid: mids[pair.name] ?? mids[`@${pair.index}`] ?? '-',
  }
}

function toGalleryOutcomes(outcomes: UsdhOutcomeMarket[]): GalleryOutcome[] {
  return outcomes.map((outcome) => ({
    id: outcome.outcome,
    name: outcome.name,
    sides: [outcome.sides[0].name, outcome.sides[1].name],
    coin: outcome.sides[0].coin,
  }))
}

function toGalleryBook(book: L2Book): GalleryBook {
  return {
    coin: book.coin,
    bids: book.levels[0].slice(0, 3).map(toGalleryLevel),
    asks: book.levels[1].slice(0, 3).map(toGalleryLevel),
  }
}

function toGalleryLevel(level: L2Book['levels'][number][number]): GalleryBookLevel {
  return {
    price: level.px,
    size: compactDecimal(level.sz),
    orders: level.n,
  }
}

function compactDecimal(value: string): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: parsed >= 1_000 ? 0 : 4,
  }).format(parsed)
}
