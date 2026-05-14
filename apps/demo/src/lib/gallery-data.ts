import {
  type L2Book,
  type UsdhOutcomeMarket,
  type UsdhPair,
  createInfoClient,
  listUsdhSpotPairs,
  normalizeOutcomeMeta,
  probabilityFromBook,
} from '@usdh-kit/sdk'

export type GalleryDataMode = 'live' | 'sample'
export type GalleryFreshness = 'fresh' | 'stale' | 'fallback'

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
  sideCoins: [string, string]
  sideReads: [GalleryOutcomeSideRead, GalleryOutcomeSideRead]
}

export interface GalleryOutcomeSideRead {
  side: string
  coin: string
  probability: number
  bestBid: string
  bestAsk: string
  depth: string
  source: GalleryDataMode
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
  freshness: GalleryFreshness
  generatedAt: string
  pairs: GalleryPair[]
  outcomes: GalleryOutcome[]
  book: GalleryBook
  notes: string[]
}

const SAMPLE_SNAPSHOT: GallerySnapshot = {
  mode: 'sample',
  freshness: 'fallback',
  generatedAt: new Date(0).toISOString(),
  pairs: [
    { name: '@230', label: 'USDH/USDC', index: 230, role: 'base', mid: '1.0002' },
    { name: '@232', label: 'HYPE/USDH', index: 232, role: 'quote', mid: '42.18' },
    { name: '@235', label: 'PURR/USDH', index: 235, role: 'quote', mid: '0.183' },
  ],
  outcomes: [
    sampleOutcome(20, 'USDH weekly volume clears $5m', '#200', 70),
    sampleOutcome(24, 'HYPE weekly close green', '#240', 64),
    sampleOutcome(31, 'Fed cuts at next meeting', '#310', 41),
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

const LIVE_TIMEOUT_MS = 1_000
const LIVE_DEADLINE_MS = 650
const LIVE_CACHE_TTL_MS = 10_000

type LiveCacheEntry = {
  snapshot: GallerySnapshot
  expiresAt: number
  inflight?: Promise<GallerySnapshot>
}

const liveSnapshotCache = new Map<string, LiveCacheEntry>()

export async function loadGallerySnapshot(options?: {
  mode?: GalleryDataMode
  bookCoin?: string
}): Promise<GallerySnapshot> {
  if (options?.mode === 'sample') {
    return sampleNow(['mocked preview data'])
  }
  return loadCachedLiveGallerySnapshot(options?.bookCoin)
}

function loadCachedLiveGallerySnapshot(bookCoin?: string): Promise<GallerySnapshot> {
  const key = bookCoin ?? 'default'
  const cached = liveSnapshotCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.snapshot)
  }
  if (cached?.snapshot) {
    if (!cached.inflight) {
      void refreshLiveGallerySnapshot(key, bookCoin, cached)
    }
    return Promise.resolve({
      ...cached.snapshot,
      freshness: 'stale',
      notes: ['refreshing read cache', ...cached.snapshot.notes.slice(0, 2)],
    })
  }

  const inflight = refreshLiveGallerySnapshot(key, bookCoin, cached)
  return withSnapshotDeadline(inflight, LIVE_DEADLINE_MS)
}

function refreshLiveGallerySnapshot(
  key: string,
  bookCoin: string | undefined,
  cached: LiveCacheEntry | undefined,
): Promise<GallerySnapshot> {
  const inflight = loadLiveGallerySnapshot(bookCoin).then((snapshot) => {
    liveSnapshotCache.set(key, {
      snapshot,
      expiresAt: Date.now() + LIVE_CACHE_TTL_MS,
    })
    return snapshot
  })
  liveSnapshotCache.set(key, {
    snapshot: cached?.snapshot ?? sampleNow(['mainnet refresh pending']),
    expiresAt: cached?.expiresAt ?? 0,
    inflight,
  })
  return inflight
}

async function loadLiveGallerySnapshot(bookCoin?: string): Promise<GallerySnapshot> {
  try {
    const info = createInfoClient({ network: 'mainnet', timeoutMs: LIVE_TIMEOUT_MS })
    const [spotMetaResult, midsResult] = await Promise.allSettled([info.spotMeta(), info.allMids()])
    if (spotMetaResult.status === 'rejected') {
      return sampleNow(['spotMeta unavailable'])
    }

    const spotMeta = spotMetaResult.value
    const mids = midsResult.status === 'fulfilled' ? midsResult.value : {}
    const pairs = listUsdhSpotPairs(spotMeta)
    if (pairs.length === 0) return sampleNow(['no live USDH pairs returned'])

    const requestedPair =
      bookCoin === undefined
        ? undefined
        : pairs.find((pair) => pair.name === bookCoin || `@${pair.index}` === bookCoin)
    const primaryPair =
      requestedPair ??
      pairs.find((pair) => pair.base === 'USDH' && pair.quote === 'USDC') ??
      pairs[0]
    if (primaryPair === undefined) return sampleNow(['no primary USDH pair returned'])

    const [bookResult, outcomesResult] = await Promise.allSettled([
      info.l2Book(primaryPair.name),
      info.outcomeMeta(),
    ])

    const normalizedOutcomes =
      outcomesResult.status === 'fulfilled'
        ? normalizeOutcomeMeta(outcomesResult.value).slice(0, 3)
        : []
    const liveOutcomes =
      normalizedOutcomes.length > 0
        ? await hydrateOutcomeReads(info, normalizedOutcomes)
        : SAMPLE_SNAPSHOT.outcomes

    return {
      mode: 'live',
      freshness: 'fresh',
      generatedAt: new Date().toISOString(),
      pairs: pairs.slice(0, 5).map((pair) => toGalleryPair(pair, mids)),
      outcomes: liveOutcomes.length > 0 ? liveOutcomes : SAMPLE_SNAPSHOT.outcomes,
      book:
        bookResult.status === 'fulfilled'
          ? toGalleryBook(bookResult.value)
          : { ...SAMPLE_SNAPSHOT.book, coin: primaryPair.name },
      notes: [
        'mainnet read-only',
        midsResult.status === 'fulfilled' ? 'mids live' : 'mids sample',
        outcomesResult.status === 'fulfilled' ? 'outcomes live' : 'outcomes sample',
        bookResult.status === 'fulfilled' ? 'book live' : 'book sample',
      ],
    }
  } catch (err) {
    return sampleNow([err instanceof Error ? err.message : 'live data unavailable'])
  }
}

function withSnapshotDeadline(
  promise: Promise<GallerySnapshot>,
  timeoutMs: number,
): Promise<GallerySnapshot> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<GallerySnapshot>((resolve) => {
    timer = setTimeout(() => resolve(sampleNow(['live data timeout'])), timeoutMs)
  })
  return Promise.race([
    promise.finally(() => {
      if (timer !== undefined) clearTimeout(timer)
    }),
    timeout,
  ])
}

function sampleNow(notes: string[]): GallerySnapshot {
  return {
    ...SAMPLE_SNAPSHOT,
    freshness: 'fallback',
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

async function hydrateOutcomeReads(
  info: ReturnType<typeof createInfoClient>,
  outcomes: UsdhOutcomeMarket[],
): Promise<GalleryOutcome[]> {
  const hydrated = toGalleryOutcomes(outcomes)
  if (hydrated.length === 0) return SAMPLE_SNAPSHOT.outcomes

  return Promise.all(
    hydrated.map(async (outcome) => {
      const [yesCoin, noCoin] = outcome.sideCoins
      const [yesBook, noBook] = await Promise.allSettled([
        info.l2Book(yesCoin),
        info.l2Book(noCoin),
      ])

      return {
        ...outcome,
        sideReads: [
          sideReadFromBook(outcome.sides[0], yesCoin, yesBook, outcome.id, 0),
          sideReadFromBook(outcome.sides[1], noCoin, noBook, outcome.id, 1),
        ],
      }
    }),
  )
}

function toGalleryOutcomes(outcomes: UsdhOutcomeMarket[]): GalleryOutcome[] {
  return outcomes.map((outcome) => ({
    id: outcome.outcome,
    name: outcome.name,
    sides: [outcome.sides[0].name, outcome.sides[1].name],
    coin: outcome.sides[0].coin,
    sideCoins: [outcome.sides[0].coin, outcome.sides[1].coin],
    sideReads: [
      sampleOutcomeSideRead(outcome.sides[0].name, outcome.sides[0].coin, outcome.outcome, 0),
      sampleOutcomeSideRead(outcome.sides[1].name, outcome.sides[1].coin, outcome.outcome, 1),
    ],
  }))
}

function sideReadFromBook(
  side: string,
  coin: string,
  result: PromiseSettledResult<L2Book>,
  outcomeId: number,
  sideIndex: 0 | 1,
): GalleryOutcomeSideRead {
  if (result.status === 'rejected') return sampleOutcomeSideRead(side, coin, outcomeId, sideIndex)
  const bid = result.value.levels[0][0]?.px ?? '-'
  const ask = result.value.levels[1][0]?.px ?? '-'
  const probability =
    probabilityFromBook({ bestBid: bid, bestAsk: ask }) ??
    sampleOutcomeSideRead(side, coin, outcomeId, sideIndex).probability
  return {
    side,
    coin,
    probability,
    bestBid: bid,
    bestAsk: ask,
    depth: compactBookDepth(result.value),
    source: 'live',
  }
}

function sampleOutcome(
  id: number,
  name: string,
  coin: `#${number}`,
  yesProbability: number,
): GalleryOutcome {
  const noCoin = `#${Number(coin.slice(1)) + 1}` as `#${number}`
  return {
    id,
    name,
    sides: ['Yes', 'No'],
    coin,
    sideCoins: [coin, noCoin],
    sideReads: [
      sampleOutcomeSideRead('Yes', coin, id, 0, yesProbability),
      sampleOutcomeSideRead('No', noCoin, id, 1, 100 - Math.max(12, yesProbability - 4)),
    ],
  }
}

function sampleOutcomeSideRead(
  side: string,
  coin: string,
  outcomeId: number,
  sideIndex: 0 | 1,
  probabilityOverride?: number,
): GalleryOutcomeSideRead {
  const probability =
    probabilityOverride ?? Math.min(88, Math.max(14, 52 + ((outcomeId * 7 + sideIndex * 17) % 36)))
  const bid = Math.max(0.01, (probability - 2) / 100)
  const ask = Math.min(0.99, (probability + 2) / 100)
  return {
    side,
    coin,
    probability,
    bestBid: bid.toFixed(2),
    bestAsk: ask.toFixed(2),
    depth: sideIndex === 0 ? '$18.4k' : '$12.1k',
    source: 'sample',
  }
}

function compactBookDepth(book: L2Book): string {
  const total = [...book.levels[0].slice(0, 3), ...book.levels[1].slice(0, 3)].reduce(
    (sum, level) => sum + Number(level.sz),
    0,
  )
  if (!Number.isFinite(total)) return '-'
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(1)}m`
  if (total >= 1_000) return `$${(total / 1_000).toFixed(1)}k`
  return `$${total.toFixed(0)}`
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
