import type { ComponentSlug } from './component-registry'

export interface ComponentSdkRead {
  rawRead: string
  adapter: string
  produces: string
  parentOwns: string
}

export function getComponentSdkReads(slug: ComponentSlug): ComponentSdkRead[] {
  switch (slug) {
    case 'usdh-widget':
      return [
        {
          rawRead:
            'USDHSwap owns its packaged quote flow; companion context can read spotMeta + l2Book.',
          adapter: 'createQuoteSummaryData from @usdh-kit/sdk for companion read context.',
          produces: 'pair, best ask, spread, receive estimate',
          parentOwns: 'wallet provider, page placement, analytics, and surrounding cache',
        },
      ]
    case 'market-board':
      return [
        {
          rawRead: 'createInfoClient().spotMeta() + listUsdhSpotPairs() + info.l2Book(pair.name)',
          adapter: 'createQuoteSummaryData from @usdh-kit/sdk',
          produces: 'pair, bid, ask, spread, depth, readiness',
          parentOwns: 'amount input, pair selection, stale reads, and submit flow',
        },
      ]
    case 'quote-readiness':
      return [
        {
          rawRead: 'listUsdhSpotPairs(await info.spotMeta()) + info.l2Book(selectedPair.name)',
          adapter: 'createQuoteReadiness from @usdh-kit/sdk',
          produces: 'pair found, book valid, spread ok, depth ok, block reason',
          parentOwns: 'thresholds, polling, stale cache, disabled state, and write handoff',
        },
      ]
    case 'outcome-reads':
      return [
        {
          rawRead: 'info.outcomeMeta() + info.l2Book(outcomeCoin(outcome, side))',
          adapter: 'createOutcomeEventData from @usdh-kit/sdk',
          produces: 'event title, sides, side coins, odds, top-of-book context',
          parentOwns: 'routing, market selection, cache, and every trade action',
        },
      ]
    case 'outcome-market-row':
      return [
        {
          rawRead: 'normalizeOutcomeMeta(await info.outcomeMeta())',
          adapter: 'createOutcomeMarketRows from @usdh-kit/sdk',
          produces: 'market id, title, side labels, side coins, compact prices',
          parentOwns: 'search, sort, pagination, selection, and route navigation',
        },
      ]
    case 'outcome-odds-selector':
      return [
        {
          rawRead: 'outcomeCoin(outcome, side) + optional side l2Book',
          adapter: 'createOutcomeSideSelection from @usdh-kit/sdk',
          produces: 'selected coin, side label, price, probability, pressed state',
          parentOwns: 'controlled value, review lock, and ticket handoff',
        },
      ]
    case 'outcome-order-book':
      return [
        {
          rawRead: 'info.l2Book(selectedSideCoin, { nSigFigs: 5 })',
          adapter: 'createOutcomeOrderBookSummary from @usdh-kit/sdk',
          produces: 'bid rows, ask rows, spread, depth, and book health',
          parentOwns: 'selected side, polling/subscription policy, and price-level clicks',
        },
      ]
    case 'outcome-position-row':
      return [
        {
          rawRead: 'wallet balances + normalizeOutcomeMeta(await info.outcomeMeta())',
          adapter: 'createOutcomePositionRows from @usdh-kit/sdk',
          produces: 'resolved HIP-4 position rows with market, side, coin, quantity, and mark',
          parentOwns: 'wallet address, balance refresh, settlement, PnL, and payouts',
        },
      ]
    case 'order-ticket-mock':
      return [
        {
          rawRead: 'selected USDH spot pair + optional l2Book for validation context',
          adapter: 'createSpotOrderDraft from @usdh-kit/sdk',
          produces: 'review checks, block reason, notional, and placeOrderInput',
          parentOwns: 'signer, exchange client, tick-size rules, balances, and submission',
        },
      ]
    default:
      return []
  }
}
