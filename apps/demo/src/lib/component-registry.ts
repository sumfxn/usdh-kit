import {
  ArrowLeftRight,
  BookOpen,
  Boxes,
  Braces,
  ChartNoAxesColumn,
  Coins,
  GitBranch,
  ListChecks,
  type LucideIcon,
  Route,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'

export type RegistryDataMode = 'sample' | 'live'

export type ComponentSlug =
  | 'usdh-widget'
  | 'usdh-migration'
  | 'market-board'
  | 'quote-readiness'
  | 'outcome-reads'
  | 'outcome-market-row'
  | 'outcome-odds-selector'
  | 'outcome-order-book'
  | 'outcome-position-row'
  | 'order-ticket-mock'
  | 'flow-chart'
  | 'bridge-swap-route'
  | 'sdk-primitive-cards'

export interface ComponentSnippet {
  title: string
  language: 'tsx' | 'ts'
  code: string
}

export interface ComponentVariant {
  id: string
  title: string
  description: string
  previewId: string
  snippet: ComponentSnippet
}

export interface ComponentUseCase {
  usedFor: string
  reads: string
  doesNot: string
}

export interface ComponentEntry {
  slug: ComponentSlug
  title: string
  shortTitle: string
  eyebrow: string
  category: 'Widget' | 'USDH' | 'HIP-4' | 'Trading' | 'Flows' | 'SDK'
  description: string
  icon: LucideIcon
  tags: string[]
  liveCapable: boolean
  visible: boolean
  snippets: ComponentSnippet[]
  variants?: ComponentVariant[]
  useCase: ComponentUseCase
  usage?: ComponentSnippet
  installCommand?: string
  composition?: string
}

export interface ComponentSection {
  title: string
  items: ComponentSlug[]
}

export interface BuilderPathStep {
  slug: ComponentSlug
  title: string
  shortTitle: string
  description: string
  boundary: 'read-only' | 'ticket handoff'
}

const sdkInstall = 'pnpm add @usdh-kit/sdk'

export const componentEntries: ComponentEntry[] = [
  {
    slug: 'usdh-widget',
    title: 'USDH Swap Widget',
    shortTitle: 'Widget',
    eyebrow: 'Legacy swap',
    category: 'Widget',
    description:
      'The packaged legacy swap component for historical USDC to USDH flows, kept only for compatibility.',
    icon: WalletCards,
    tags: ['widget', 'swap', 'usdc', 'usdh', 'wallet'],
    liveCapable: true,
    visible: true,
    snippets: [
      {
        title: 'Render widget',
        language: 'tsx',
        code: `'use client'

import { USDHSwap } from '@usdh-kit/widget'
import '@usdh-kit/widget/styles.css'

export function UsdhSwapEntry() {
  return <USDHSwap network="mainnet" defaultAmount="250" theme="auto" />
}`,
      },
    ],
    variants: [
      {
        id: 'pre-wallet-context',
        title: 'Pre-wallet Quote',
        description: 'Show expected receive, spread, and readiness before the user connects.',
        previewId: 'pre-wallet-context',
        snippet: {
          title: 'Compose read context',
          language: 'tsx',
          code: `import { USDHSwap } from '@usdh-kit/widget'
import '@usdh-kit/widget/styles.css'

export function SwapCard({ context }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <USDHSwap network="mainnet" defaultAmount="250" />
      <QuoteContext context={context} />
    </div>
  )
}`,
        },
      },
    ],
    useCase: {
      usedFor: 'Legacy USDH acquisition flows and historical integration reference.',
      reads: 'Pair, best ask, spread, receive estimate, and quote readiness before connect.',
      doesNot:
        'Represent the migration path, change the widget API, or unlock writes before wallet/session state.',
    },
    usage: {
      title: 'Pre-wallet swap entry',
      language: 'tsx',
      code: `export function SwapEntry({ quoteContext }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_320px]" aria-label="Legacy swap USDC to USDH">
      <USDHSwap network="mainnet" defaultAmount="250" />
      <QuoteContext {...quoteContext} />
    </section>
  )
}`,
    },
    installCommand: 'pnpm add @usdh-kit/widget wagmi viem',
    composition:
      'Keep USDHSwap as a legacy write boundary; prefer USDHMigration for the sunset path.',
  },
  {
    slug: 'usdh-migration',
    title: 'USDH Migration',
    shortTitle: 'Migration',
    eyebrow: 'Drop-in exit',
    category: 'Widget',
    description:
      'The primary sunset component: convert a HyperCore USDH balance back to USDC with wallet-gated writes.',
    icon: ArrowLeftRight,
    tags: ['widget', 'migration', 'usdh', 'usdc', 'exit'],
    liveCapable: true,
    visible: true,
    snippets: [
      {
        title: 'Render migration widget',
        language: 'tsx',
        code: `'use client'

import { USDHMigration } from '@usdh-kit/widget'
import '@usdh-kit/widget/styles.css'

export function UsdhMigrationEntry() {
  return <USDHMigration network="mainnet" defaultAmount="250" theme="auto" />
}`,
      },
    ],
    useCase: {
      usedFor: 'Wallet exit flows, USDH wind-down banners, and balance migration prompts.',
      reads: 'HyperCore USDH balance, USDH/USDC pair, and the sell-side receive estimate.',
      doesNot:
        'Bridge to HyperEVM, fake receive estimates, or submit swaps before wallet/session state.',
    },
    usage: {
      title: 'USDH exit entry',
      language: 'tsx',
      code: `export function MigrationEntry() {
  return (
    <section aria-label="Migrate USDH to USDC">
      <USDHMigration network="mainnet" defaultAmount="250" />
    </section>
  )
}`,
    },
    installCommand: 'pnpm add @usdh-kit/widget wagmi viem',
    composition: 'Use USDHMigration as the write boundary for the USDH wind-down exit path.',
  },
  {
    slug: 'market-board',
    title: 'Quote Summary',
    shortTitle: 'Quote summary',
    eyebrow: 'Swap quote pattern',
    category: 'USDH',
    description:
      'A compact read-only quote module for swap forms: pair, receive estimate, spread, depth, and readiness.',
    icon: ChartNoAxesColumn,
    tags: ['quote', 'spread', 'depth', 'pair', 'swap'],
    liveCapable: true,
    visible: true,
    snippets: [
      {
        title: 'Quote summary',
        language: 'tsx',
        code: `<QuoteSummary
  pair="USDH/USDC"
  pay="250 USDC"
  receive="249.98 USDH"
  spreadBps={2}
  depthUsd={68_500}
  status="ready"
/>`,
      },
    ],
    variants: [
      {
        id: 'inline',
        title: 'Inline Summary',
        description: 'Small enough to sit under an amount input or quote button.',
        previewId: 'inline',
        snippet: {
          title: 'Inline quote row',
          language: 'tsx',
          code: `<QuoteSummary
  pair="USDH/USDC"
  pay="250 USDC"
  receive="249.98 USDH"
  spreadBps={2}
/>`,
        },
      },
      {
        id: 'pair-select',
        title: 'Pair Select',
        description: 'A compact selector for apps that expose more than one USDH pair.',
        previewId: 'pair-select',
        snippet: {
          title: 'Pair selector',
          language: 'tsx',
          code: `import { createInfoClient, listUsdhSpotPairs } from '@usdh-kit/sdk'

const info = createInfoClient({ network: 'mainnet' })
const pairs = listUsdhSpotPairs(await info.spotMeta())

return <PairSelect pairs={pairs} value={selectedPair} onChange={setSelectedPair} />`,
        },
      },
      {
        id: 'depth',
        title: 'Depth Detail',
        description: 'A fuller variant for trading drawers that need bid/ask context.',
        previewId: 'depth',
        snippet: {
          title: 'Top of book detail',
          language: 'ts',
          code: `const book = await info.l2Book(selectedPair.name, { nSigFigs: 5 })
const [bestBid] = book.levels[0]
const [bestAsk] = book.levels[1]`,
        },
      },
    ],
    useCase: {
      usedFor: 'Swap forms, quote review cards, and wallet dashboard previews.',
      reads: 'USDH pair discovery, selected order book, best ask/bid, spread, and depth.',
      doesNot: 'Select a wallet, submit a quote, or call exchange write endpoints.',
    },
    usage: {
      title: 'Build quote summary data',
      language: 'ts',
      code: `import { createInfoClient, createQuoteSummaryData, listUsdhSpotPairs } from '@usdh-kit/sdk'

const info = createInfoClient({ network: 'mainnet' })
const pairs = listUsdhSpotPairs(await info.spotMeta())
const pair = pairs.find((item) => item.base === 'USDH' && item.quote === 'USDC')
const book = pair ? await info.l2Book(pair.name, { nSigFigs: 5 }) : null

const summary = createQuoteSummaryData({
  pair,
  book,
  amount: '250',
  payAsset: 'USDC',
  maxSpreadBps: 10,
  minSideDepth: 1_000,
})

const quoteReady = summary.ready
const receive = summary.receive?.amount`,
    },
    installCommand: sdkInstall,
    composition: 'Keep this as a read-only companion to a swap form; the form owns submit state.',
  },
  {
    slug: 'quote-readiness',
    title: 'Quote Readiness',
    shortTitle: 'Readiness',
    eyebrow: 'Quote guard pattern',
    category: 'USDH',
    description:
      'A compact readiness row for quote buttons and tickets: pair found, book valid, spread acceptable, and depth available.',
    icon: ShieldCheck,
    tags: ['quote', 'readiness', 'guard', 'spread', 'depth'],
    liveCapable: true,
    visible: true,
    snippets: [
      {
        title: 'Readiness row',
        language: 'tsx',
        code: `<QuoteReadiness
  pair="USDH/USDC"
  checks={[
    { label: 'Pair', state: 'ready', value: 'found' },
    { label: 'Book', state: 'ready', value: 'bid / ask' },
    { label: 'Spread', state: 'ready', value: '2.0 bps' },
    { label: 'Depth', state: 'ready', value: '$68.5k' },
  ]}
/>`,
      },
    ],
    variants: [
      {
        id: 'compact',
        title: 'Compact Guard',
        description: 'Small enough to sit above a quote button or inside a ticket header.',
        previewId: 'readiness-compact',
        snippet: {
          title: 'Compact readiness guard',
          language: 'tsx',
          code: `<QuoteReadiness
  compact
  pair="USDH/USDC"
  checks={quoteReadinessChecks}
/>`,
        },
      },
      {
        id: 'blocked',
        title: 'Blocked Quote',
        description: 'Makes an invalid book or wide spread explicit without turning into an alert.',
        previewId: 'readiness-blocked',
        snippet: {
          title: 'Blocked readiness',
          language: 'tsx',
          code: `<QuoteReadiness
  pair="USDH/USDC"
  checks={[
    { label: 'Pair', state: 'ready', value: 'found' },
    { label: 'Book', state: 'blocked', value: 'empty ask' },
    { label: 'Spread', state: 'blocked', value: '-' },
    { label: 'Depth', state: 'blocked', value: '$0' },
  ]}
/>`,
        },
      },
    ],
    useCase: {
      usedFor: 'Quote buttons, swap forms, ticket headers, and review drawers.',
      reads: 'Pair discovery, selected l2Book, best bid/ask, spread, and top-of-book depth.',
      doesNot: 'Submit quotes, place orders, or decide wallet permissions inside the component.',
    },
    usage: {
      title: 'Build readiness from top-of-book',
      language: 'ts',
      code: `import { createQuoteReadiness } from '@usdh-kit/sdk'

const readiness = createQuoteReadiness({
  pair,
  book,
  maxSpreadBps: 10,
  minSideDepth: 1_000,
})

const quoteReady = readiness.ready
const disabledReason = readiness.blockReason`,
    },
    installCommand: sdkInstall,
    composition:
      'Use this as a read-only guard near quote actions; the parent app owns the disabled state.',
  },
  {
    slug: 'outcome-reads',
    title: 'Outcome Event Card',
    shortTitle: 'Event card',
    eyebrow: 'HIP-4 prediction pattern',
    category: 'HIP-4',
    description:
      'A prediction-market card that turns HIP-4 outcome reads into a feed-ready market card.',
    icon: Coins,
    tags: ['outcome', 'event', 'odds', 'prediction', 'side coin'],
    liveCapable: true,
    visible: true,
    snippets: [
      {
        title: 'Event card',
        language: 'tsx',
        code: `import { OutcomeEventCard } from './outcomes'
import { createOutcomeEventData, normalizeOutcomeMeta } from '@usdh-kit/sdk'

const [market] = normalizeOutcomeMeta({
  outcomes: [{
    outcome: 20,
    name: 'USDH weekly volume clears $5m',
    description: '',
    sideSpecs: [{ name: 'Yes' }, { name: 'No' }],
  }],
})

const event = createOutcomeEventData(market, [
  { probability: 70, bestBid: '0.69', bestAsk: '0.72' },
  { probability: 34, bestBid: '0.32', bestAsk: '0.36' },
])

export function MarketCard() {
  return <OutcomeEventCard event={event} />
}`,
      },
      {
        title: 'Map reads',
        language: 'ts',
        code: `import { createOutcomeEventData, outcomeCoin } from '@usdh-kit/sdk'

const yesCoin = outcomeCoin(market.outcome, 0)
const noCoin = outcomeCoin(market.outcome, 1)

const [yesBook, noBook] = await Promise.all([
  info.l2Book(yesCoin, { nSigFigs: 5 }),
  info.l2Book(noCoin, { nSigFigs: 5 }),
])

const event = createOutcomeEventData(market, [
  { book: yesBook },
  { book: noBook },
])`,
      },
    ],
    variants: [
      {
        id: 'compact',
        title: 'Compact Card',
        description: 'A compact card for event feeds and watchlists.',
        previewId: 'compact',
        snippet: {
          title: 'Compact event card',
          language: 'tsx',
          code: '<OutcomeEventCard event={event} compact />',
        },
      },
      {
        id: 'with-book',
        title: 'Market Header',
        description: 'Adds side coin and top-of-book context for a market detail page.',
        previewId: 'with-book',
        snippet: {
          title: 'Show side book context',
          language: 'tsx',
          code: '<OutcomeEventCard event={event} showBookContext />',
        },
      },
      {
        id: 'loading',
        title: 'Loading State',
        description: 'Keeps the card shape stable while live books or mids hydrate.',
        previewId: 'loading',
        snippet: {
          title: 'Render loading card',
          language: 'tsx',
          code: '<OutcomeLoadingCard />',
        },
      },
      {
        id: 'illiquid',
        title: 'No Liquidity',
        description: 'Shows the market without pretending the side book is quote-ready.',
        previewId: 'illiquid',
        snippet: {
          title: 'Render no-liquidity card',
          language: 'tsx',
          code: `<OutcomeEventCard
  event={outcomeEventWithoutLiquidity(event)}
  showBookContext
/>`,
        },
      },
    ],
    useCase: {
      usedFor: 'Prediction market feeds, market detail headers, and watchlist cards.',
      reads: 'Outcome metadata, side coins, implied chances, and optional top-of-book prices.',
      doesNot: 'Place trades, infer sides from labels, or expose write actions by default.',
    },
    usage: {
      title: 'Map HIP-4 outcome to card data',
      language: 'ts',
      code: `import {
  createInfoClient,
  createOutcomeEventData,
  normalizeOutcomeMeta,
  outcomeCoin,
} from '@usdh-kit/sdk'

const info = createInfoClient({ network: 'mainnet' })
const [market] = normalizeOutcomeMeta(await info.outcomeMeta())

const [yesBook, noBook] = await Promise.all([
  info.l2Book(outcomeCoin(market.outcome, 0), { nSigFigs: 5 }),
  info.l2Book(outcomeCoin(market.outcome, 1), { nSigFigs: 5 }),
])

const event = createOutcomeEventData(market, [
  { book: yesBook },
  { book: noBook },
])`,
    },
    installCommand: sdkInstall,
    composition: 'Use the event card as the primary consumer-facing outcome surface.',
  },
  {
    slug: 'outcome-market-row',
    title: 'Outcome Market Row',
    shortTitle: 'Market row',
    eyebrow: 'HIP-4 list pattern',
    category: 'HIP-4',
    description:
      'A compact row for prediction market lists, search results, and watchlists with resolved Yes/No pricing.',
    icon: ListChecks,
    tags: ['outcome', 'row', 'list', 'market', 'watchlist'],
    liveCapable: true,
    visible: true,
    snippets: [
      {
        title: 'Market row',
        language: 'tsx',
        code: `import { OutcomeMarketRows } from './outcomes'

export function MarketList({ events, selectedId, setSelectedId }) {
  return (
    <OutcomeMarketRows
      events={events}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  )
}`,
      },
    ],
    variants: [
      {
        id: 'dense-list',
        title: 'Dense List',
        description: 'A scan-friendly list for app home feeds and market discovery.',
        previewId: 'market-row',
        snippet: {
          title: 'Dense outcome list',
          language: 'tsx',
          code: `<OutcomeMarketRows
  events={events}
  selectedId={selectedId}
  onSelect={setSelectedId}
/>`,
        },
      },
      {
        id: 'long-title',
        title: 'Long Title',
        description: 'Stress case for verbose market names from outcomeMeta.',
        previewId: 'long-title',
        snippet: {
          title: 'Long market row',
          language: 'tsx',
          code: `<OutcomeMarketRows
  events={[longTitleEvent, ...events.slice(1)]}
  selectedId={longTitleEvent.id}
  onSelect={setSelectedId}
/>`,
        },
      },
      {
        id: 'empty',
        title: 'Empty List',
        description: 'A calm empty state when filters or live reads return no markets.',
        previewId: 'empty',
        snippet: {
          title: 'Empty market list',
          language: 'tsx',
          code: '<OutcomeEmptyList />',
        },
      },
    ],
    useCase: {
      usedFor: 'Market lists, search results, watchlists, and compact discovery views.',
      reads: 'Outcome metadata, side coins, current side prices, and market id.',
      doesNot: 'Render a full chart, place orders, or hide the side coin mapping.',
    },
    usage: {
      title: 'Build rows from outcomeMeta',
      language: 'ts',
      code: `import { createOutcomeMarketRows, normalizeOutcomeMeta } from '@usdh-kit/sdk'

const markets = normalizeOutcomeMeta(await info.outcomeMeta())

const events = createOutcomeMarketRows({
  markets,
  limit: 20,
})`,
    },
    installCommand: sdkInstall,
    composition:
      'Use rows as navigation into a market detail page; keep trade intent out of this component.',
  },
  {
    slug: 'outcome-odds-selector',
    title: 'Outcome Odds Selector',
    shortTitle: 'Odds selector',
    eyebrow: 'HIP-4 side pattern',
    category: 'HIP-4',
    description:
      'A side selector for market detail pages and order forms that makes Yes/No coins understandable before any write.',
    icon: Braces,
    tags: ['outcome', 'odds', 'selector', 'side coin', 'prediction'],
    liveCapable: true,
    visible: true,
    snippets: [
      {
        title: 'Odds selector',
        language: 'tsx',
        code: `import { useState } from 'react'
import { OutcomeOddsSelector } from './outcomes'

export function SidePicker({ event }) {
  const [sideCoin, setSideCoin] = useState(event.sides[0].coin)

  return (
    <OutcomeOddsSelector
      event={event}
      value={sideCoin}
      onValueChange={setSideCoin}
    />
  )
}`,
      },
    ],
    variants: [
      {
        id: 'ticket-side',
        title: 'Ticket Side Picker',
        description: 'A clear side selection surface to mount above a guarded order ticket.',
        previewId: 'odds-selector',
        snippet: {
          title: 'Use with ticket draft',
          language: 'tsx',
          code: `<OutcomeOddsSelector
  event={event}
  value={draft.sideCoin}
  onValueChange={(coin) => setDraft({ ...draft, sideCoin: coin })}
/>`,
        },
      },
      {
        id: 'disabled',
        title: 'Disabled During Review',
        description: 'Locks the side selection once a parent order ticket enters review.',
        previewId: 'disabled',
        snippet: {
          title: 'Disabled side picker',
          language: 'tsx',
          code: '<OutcomeOddsSelector event={event} disabled />',
        },
      },
    ],
    useCase: {
      usedFor: 'Market detail pages, trade tickets, and side-aware watchlist filters.',
      reads: 'Side labels, side coins, best ask, implied chance, and selected side.',
      doesNot: 'Submit trades or assume Yes/No labels are the only possible side names.',
    },
    usage: {
      title: 'Resolve selected side',
      language: 'ts',
      code: `import { createOutcomeSideSelection } from '@usdh-kit/sdk'

const selection = createOutcomeSideSelection({
  market,
  selected: selectedCoin,
  reads: [{ book: yesBook }, { book: noBook }],
})

const selectedBook = await info.l2Book(selection.selectedCoin, { nSigFigs: 5 })`,
    },
    installCommand: sdkInstall,
    composition:
      'Use this as the bridge between read-only market data and a separately gated order form.',
  },
  {
    slug: 'outcome-order-book',
    title: 'Outcome Order Book',
    shortTitle: 'Order book',
    eyebrow: 'HIP-4 depth pattern',
    category: 'HIP-4',
    description:
      'A compact order book for one selected outcome side, suitable for market details and ticket sidebars.',
    icon: BookOpen,
    tags: ['outcome', 'order book', 'depth', 'side coin', 'market detail'],
    liveCapable: true,
    visible: true,
    snippets: [
      {
        title: 'Outcome order book',
        language: 'tsx',
        code: `import { useState } from 'react'
import { createOutcomeOrderBookSummary } from '@usdh-kit/sdk'
import { OutcomeOrderBook } from './outcomes'

export function SideBook({ event, sideBook }) {
  const [sideIndex, setSideIndex] = useState(0)
  const side = event.sides[sideIndex] ?? event.sides[0]
  const summary = createOutcomeOrderBookSummary(sideBook)

  return (
    <OutcomeOrderBook
      event={event}
      sideIndex={sideIndex}
      levelsByCoin={{ [side.coin]: summary.levels }}
      onSideChange={(_, index) => setSideIndex(index)}
    />
  )
}`,
      },
    ],
    variants: [
      {
        id: 'side-book',
        title: 'Side Book',
        description: 'A small book for a selected side coin on a market detail page.',
        previewId: 'order-book',
        snippet: {
          title: 'Fetch selected side book',
          language: 'ts',
          code: `import { createOutcomeOrderBookSummary } from '@usdh-kit/sdk'

const selectedSide = outcomeCoin(market.outcome, sideIndex)
const book = await info.l2Book(selectedSide, { nSigFigs: 5 })
const summary = createOutcomeOrderBookSummary(book)
const levelsByCoin = { [selectedSide]: summary.levels }`,
        },
      },
      {
        id: 'empty-book',
        title: 'Empty Book',
        description: 'Shows the selected side without fake depth when no levels are available.',
        previewId: 'empty-book',
        snippet: {
          title: 'Empty side book',
          language: 'tsx',
          code: '<OutcomeOrderBook event={event} empty />',
        },
      },
    ],
    useCase: {
      usedFor: 'Market detail pages, trading drawers, and read-only liquidity checks.',
      reads: 'Selected side coin, bid levels, ask levels, spread, and top-of-book depth.',
      doesNot: 'Aggregate all outcomes, create orders, or refresh while the tab is hidden.',
    },
    usage: {
      title: 'Read a side coin book',
      language: 'ts',
      code: `import {
  createInfoClient,
  createOutcomeOrderBookSummary,
  outcomeCoin,
} from '@usdh-kit/sdk'

const info = createInfoClient({ network: 'mainnet' })
const coin = outcomeCoin(market.outcome, 0)
const book = await info.l2Book(coin, { nSigFigs: 5 })
const summary = createOutcomeOrderBookSummary(book)
const levelsByCoin = { [coin]: summary.levels }`,
    },
    installCommand: sdkInstall,
    composition:
      'Mount this beside an odds selector or ticket; the selected side owns which book is displayed.',
  },
  {
    slug: 'outcome-position-row',
    title: 'Outcome Position Row',
    shortTitle: 'Position row',
    eyebrow: 'Portfolio pattern',
    category: 'HIP-4',
    description:
      'A portfolio/watchlist row that resolves a held HIP-4 side coin into a readable position.',
    icon: Boxes,
    tags: ['outcome', 'portfolio', 'position', 'side coin', 'watchlist'],
    liveCapable: true,
    visible: true,
    snippets: [
      {
        title: 'Position row',
        language: 'tsx',
        code: `import { OutcomePositionRows, type OutcomePositionData } from './outcomes'

const positions: OutcomePositionData[] = [
  {
    market: 'USDH weekly volume clears $5m',
    side: 'Yes',
    coin: '#200',
    position: '125.0 Yes',
    mark: '70%',
    state: 'held',
  },
]

export function PortfolioRows() {
  return <OutcomePositionRows positions={positions} />
}`,
      },
    ],
    variants: [
      {
        id: 'portfolio',
        title: 'Portfolio Row',
        description: 'A holdings row for balances, account drawers, and portfolio pages.',
        previewId: 'portfolio',
        snippet: {
          title: 'Portfolio row',
          language: 'tsx',
          code: '<OutcomePositionRows positions={positions} />',
        },
      },
      {
        id: 'resolver',
        title: 'Balance Resolver',
        description: 'Map wallet spot balances into readable HIP-4 position rows.',
        previewId: 'portfolio',
        snippet: {
          title: 'Resolve position rows',
          language: 'ts',
          code: `import { createOutcomePositionRows } from '@usdh-kit/sdk'

const positions = createOutcomePositionRows({
  markets,
  balances,
  marks: outcomeMids,
})`,
        },
      },
      {
        id: 'watchlist',
        title: 'Watchlist Row',
        description: 'A lighter row for followed markets without a wallet balance.',
        previewId: 'watchlist',
        snippet: {
          title: 'Watchlist row',
          language: 'tsx',
          code: '<OutcomePositionRows positions={watchlistRows} compact />',
        },
      },
      {
        id: 'redeemable',
        title: 'Redeemable Row',
        description: 'A settled-state row for positions that can show payout or resolution status.',
        previewId: 'redeemable',
        snippet: {
          title: 'Redeemable row',
          language: 'tsx',
          code: `<OutcomePositionRows
  positions={positions.map((position) => ({
    ...position,
    mark: 'Won',
    state: 'redeemable',
  }))}
/>`,
        },
      },
      {
        id: 'empty',
        title: 'Empty Portfolio',
        description: 'A non-alarming state for wallets with no HIP-4 side coins.',
        previewId: 'empty-positions',
        snippet: {
          title: 'Empty positions',
          language: 'tsx',
          code: '<OutcomeEmptyPositions />',
        },
      },
    ],
    useCase: {
      usedFor: 'Portfolio tables, wallet holdings, watchlists, and account drawers.',
      reads: 'Held coin, outcome metadata, resolved side, and optional side book mark.',
      doesNot: 'Require a wallet write path or leave users staring at raw #200 coin ids.',
    },
    usage: {
      title: 'Render resolved holdings',
      language: 'ts',
      code: `import {
  createInfoClient,
  createOutcomePositionRows,
  normalizeOutcomeMeta,
} from '@usdh-kit/sdk'

const info = createInfoClient({ network: 'mainnet' })
const markets = normalizeOutcomeMeta(await info.outcomeMeta())
const outcomeMids = await info.allMids()
const state = await info.spotClearinghouseState(account)

const positions = createOutcomePositionRows({
  markets,
  balances: state.balances,
  marks: outcomeMids,
})`,
    },
    installCommand: sdkInstall,
    composition:
      'Use this when the user already has or follows a side coin and needs human context.',
  },
  {
    slug: 'order-ticket-mock',
    title: 'Order Ticket',
    shortTitle: 'Order ticket',
    eyebrow: 'Trading pattern',
    category: 'Trading',
    description:
      'A client-only order ticket pattern for USDH pairs, designed for gated signed order flows.',
    icon: Braces,
    tags: ['order', 'ticket', 'trading', 'usdh'],
    liveCapable: false,
    visible: true,
    snippets: [
      {
        title: 'Order ticket',
        language: 'tsx',
        code: `import { createSpotOrderDraft } from '@usdh-kit/sdk'

const draft = createSpotOrderDraft({
  pair: 'USDH/USDC',
  side: 'buy',
  size: '25',
  price: '1.0001',
  readiness,
  sizeDecimals: 2,
  priceDecimals: 6,
  minNotional: 10,
  availableQuote: '100',
})

<OrderTicket
  pair="USDH/USDC"
  side="buy"
  size="25"
  limitPrice="1.0001"
  canReview={draft.canReview}
  checks={draft.checks}
  onReview={() => setDraftOrder(draft.placeOrderInput)}
/>`,
      },
    ],
    variants: [
      {
        id: 'review',
        title: 'Review State',
        description: 'A gated review state before a signer action.',
        previewId: 'review',
        snippet: {
          title: 'Review state',
          language: 'tsx',
          code: `<OrderTicket pair="USDH/USDC" mode="review" writesEnabled={false} />`,
        },
      },
      {
        id: 'submitted',
        title: 'Submitted State',
        description: 'A receipt-style state for specs and QA with writes disabled.',
        previewId: 'submitted',
        snippet: {
          title: 'Submitted state',
          language: 'tsx',
          code: `<OrderTicket pair="USDH/USDC" mode="submitted" writesEnabled={false} />`,
        },
      },
    ],
    useCase: {
      usedFor: 'Trading forms, signed order UX specs, and account-level quote review.',
      reads: 'Selected USDH pair and current mid for sensible defaults.',
      doesNot: 'Call exchange endpoints, bypass signer checks, or submit from the registry.',
    },
    usage: {
      title: 'Prepare ticket handoff',
      language: 'ts',
      code: `import { createSpotOrderDraft } from '@usdh-kit/sdk'

const draft = createSpotOrderDraft({
  pair,
  side,
  size,
  price,
  readiness,
  sizeDecimals: 2,
  priceDecimals: 6,
  minNotional: 10,
  availableBase,
  availableQuote,
})

if (walletConnected && writesEnabled && draft.placeOrderInput) {
  await kit.placeOrder(draft.placeOrderInput)
}`,
    },
    installCommand: sdkInstall,
    composition:
      'Keep submit behind signer checks; the registry preview leaves writes disabled by design.',
  },
  {
    slug: 'flow-chart',
    title: 'Route State Card',
    shortTitle: 'Flow chart',
    eyebrow: 'Hidden route prototype',
    category: 'Flows',
    description: 'Legacy route state prototype kept for URL compatibility.',
    icon: Route,
    tags: ['hidden', 'route', 'prototype'],
    liveCapable: false,
    visible: false,
    snippets: [
      {
        title: 'Preflight a route',
        language: 'ts',
        code: `const route = await kit.preflightSwap({
  from: 'USDC',
  amount: 25_000_000n,
  sourceChain: 'auto',
})`,
      },
    ],
    useCase: {
      usedFor: 'Legacy QA only.',
      reads: 'Route preflight reads.',
      doesNot: 'Appear in the primary registry.',
    },
    installCommand: sdkInstall,
  },
  {
    slug: 'bridge-swap-route',
    title: 'Bridge/Swap Route',
    shortTitle: 'Bridge route',
    eyebrow: 'Hidden route prototype',
    category: 'Flows',
    description: 'Legacy route receipt prototype kept for URL compatibility.',
    icon: GitBranch,
    tags: ['hidden', 'bridge', 'route'],
    liveCapable: false,
    visible: false,
    snippets: [
      {
        title: 'Listen to route progress',
        language: 'ts',
        code: `await kit.bridgeAndSwap({
  from: 'USDC',
  amount: 25_000_000n,
  sourceChain: 'auto',
  onProgress(event) {
    console.log(event.phase)
  },
})`,
      },
    ],
    useCase: {
      usedFor: 'Legacy QA only.',
      reads: 'bridgeAndSwap lifecycle events.',
      doesNot: 'Appear in the primary registry.',
    },
    installCommand: sdkInstall,
  },
  {
    slug: 'sdk-primitive-cards',
    title: 'SDK Primitive Cards',
    shortTitle: 'SDK primitives',
    eyebrow: 'Hidden SDK prototype',
    category: 'SDK',
    description: 'Legacy SDK primitive prototype kept for URL compatibility.',
    icon: Boxes,
    tags: ['hidden', 'sdk', 'reference'],
    liveCapable: true,
    visible: false,
    snippets: [
      {
        title: 'Compose primitives',
        language: 'ts',
        code: `const [pairs, outcomes, mids] = await Promise.all([
  kit.listPairs(),
  kit.listOutcomeMarkets(),
  kit.getMids(),
])`,
      },
    ],
    useCase: {
      usedFor: 'Legacy QA only.',
      reads: 'SDK read primitives.',
      doesNot: 'Appear in the primary registry.',
    },
    installCommand: sdkInstall,
  },
]

const visibleEntryOrder = new Map<ComponentSlug, number>(
  ['usdh-migration', 'usdh-widget'].map((slug, index) => [slug as ComponentSlug, index]),
)

export const visibleComponentEntries = componentEntries
  .filter((entry) => entry.visible && visibleEntryOrder.has(entry.slug))
  .sort((a, b) => (visibleEntryOrder.get(a.slug) ?? 999) - (visibleEntryOrder.get(b.slug) ?? 999))

export const componentSections: ComponentSection[] = [
  {
    title: 'Migration',
    items: ['usdh-migration', 'usdh-widget'],
  },
]

export const hip4BuilderPathSteps: BuilderPathStep[] = [
  {
    slug: 'outcome-market-row',
    title: 'Market row',
    shortTitle: 'Discover',
    description: 'List HIP-4 markets and route into the selected event.',
    boundary: 'read-only',
  },
  {
    slug: 'outcome-reads',
    title: 'Event card',
    shortTitle: 'Render',
    description: 'Render the market card with side odds and side coins.',
    boundary: 'read-only',
  },
  {
    slug: 'outcome-odds-selector',
    title: 'Odds selector',
    shortTitle: 'Select',
    description: 'Choose the side coin before order intent exists.',
    boundary: 'read-only',
  },
  {
    slug: 'outcome-order-book',
    title: 'Order book',
    shortTitle: 'Inspect',
    description: 'Inspect depth, spread, and liquidity for that side coin.',
    boundary: 'read-only',
  },
  {
    slug: 'outcome-position-row',
    title: 'Position row',
    shortTitle: 'Resolve',
    description: 'Resolve held side coins into readable portfolio rows.',
    boundary: 'read-only',
  },
  {
    slug: 'order-ticket-mock',
    title: 'Order ticket',
    shortTitle: 'Handoff',
    description: 'Hand off to a wallet-gated ticket owned by the parent app.',
    boundary: 'ticket handoff',
  },
]

export function getBuilderPathStep(slug: ComponentSlug) {
  const index = hip4BuilderPathSteps.findIndex((step) => step.slug === slug)
  if (index === -1) return undefined

  return {
    index,
    total: hip4BuilderPathSteps.length,
    step: hip4BuilderPathSteps[index],
    previous: hip4BuilderPathSteps[index - 1],
    next: hip4BuilderPathSteps[index + 1],
  }
}

export function getComponentEntry(slug: string): ComponentEntry | undefined {
  return componentEntries.find((entry) => entry.slug === slug)
}

export function parseRegistryDataMode(value: string | string[] | undefined): RegistryDataMode {
  return value === 'sample' ? 'sample' : 'live'
}

export function componentHref(slug: ComponentSlug): string {
  return `/components/${slug}`
}
