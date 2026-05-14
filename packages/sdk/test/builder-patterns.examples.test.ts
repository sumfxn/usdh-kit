import { describe, expect, it } from 'vitest'

import {
  createOutcomeEventData,
  createOutcomeMarketRows,
  createOutcomeOrderBookSummary,
  createOutcomePositionRows,
  createOutcomeSideSelection,
  createQuoteSummaryData,
  createSpotOrderDraft,
  normalizeOutcomeMeta,
} from '../src/index.js'
import type { L2Book, OutcomeMeta, SpotBalance } from '../src/transport/types.js'

const pair = {
  kind: 'spot' as const,
  name: '@230',
  base: 'USDH',
  quote: 'USDC',
  usdhRole: 'base' as const,
  index: 230,
  tokens: [150, 0] as [number, number],
}

const pairBook: L2Book = {
  coin: '@230',
  time: 1778427457824,
  levels: [
    [
      { px: '0.9999', sz: '17000', n: 1 },
      { px: '0.9998', sz: '11000', n: 1 },
    ],
    [
      { px: '1.0001', sz: '14000', n: 1 },
      { px: '1.0002', sz: '9000', n: 1 },
    ],
  ],
}

const outcomeMeta: OutcomeMeta = {
  outcomes: [
    {
      outcome: 20,
      name: 'USDH weekly volume clears $5m',
      description: 'class:volume|asset:USDH|target:5000000',
      sideSpecs: [{ name: 'Yes' }, { name: 'No' }],
    },
    {
      outcome: 24,
      name: 'HYPE weekly close green',
      description: 'class:directional|asset:HYPE|window:weekly',
      sideSpecs: [{ name: 'Up' }, { name: 'Down' }],
    },
  ],
}

const yesBook: L2Book = {
  coin: '#200',
  time: 1778427457824,
  levels: [
    [
      { px: '0.69', sz: '250', n: 2 },
      { px: '0.68', sz: '125', n: 1 },
    ],
    [
      { px: '0.72', sz: '190', n: 1 },
      { px: '0.73', sz: '90', n: 1 },
    ],
  ],
}

const noBook: L2Book = {
  coin: '#201',
  time: 1778427457824,
  levels: [[{ px: '0.28', sz: '90', n: 1 }], [{ px: '0.31', sz: '120', n: 2 }]],
}

const balances: SpotBalance[] = [
  {
    coin: '+200',
    token: 100_000_200,
    total: '12.50',
    hold: '2.25',
    entryNtl: '8.61',
  },
  {
    coin: 'USDC',
    token: 0,
    total: '100',
    hold: '0',
    entryNtl: '0',
  },
]

describe('builder helper examples', () => {
  it('keeps the swap quote summary example executable', () => {
    const summary = createQuoteSummaryData({
      pair,
      book: pairBook,
      amount: '250',
      payAsset: 'USDC',
      maxSpreadBps: 10,
      minSideDepth: 1_000,
    })

    expect(summary.ready).toBe(true)
    expect(summary.receive).toEqual({ asset: 'USDH', amount: '249.975002' })
    if (summary.side === undefined || summary.price === undefined) {
      throw new Error('expected quote summary to resolve side and price')
    }

    const ticket = createSpotOrderDraft({
      pair,
      side: summary.side,
      size: '25',
      price: summary.price,
      readiness: summary.readiness,
      minNotional: 10,
      availableQuote: '100',
    })

    expect(ticket.canReview).toBe(true)
    expect(ticket.placeOrderInput).toMatchObject({
      pair: 'USDH/USDC',
      side: 'buy',
      size: '25',
      price: '1.0001',
    })
  })

  it('keeps the HIP-4 market detail example executable', () => {
    const markets = normalizeOutcomeMeta(outcomeMeta)
    const [market] = markets
    if (market === undefined) throw new Error('missing outcome market')

    const event = createOutcomeEventData(market, [{ book: yesBook }, { book: noBook }])
    const rows = createOutcomeMarketRows({
      markets,
      readsByCoin: {
        [market.sides[0].coin]: { book: yesBook },
        [market.sides[1].coin]: { book: noBook },
      },
      sortBy: 'probability',
    })
    const selected = createOutcomeSideSelection({
      market,
      selected: market.sides[0].coin,
      reads: [{ book: yesBook }, { book: noBook }],
    })
    const bookSummary = createOutcomeOrderBookSummary(yesBook)

    expect(event.sides[0]).toMatchObject({ coin: '#200', probability: 71 })
    expect(rows[0]?.title).toBe('USDH weekly volume clears $5m')
    expect(selected.selectedCoin).toBe('#200')
    expect(bookSummary.ready).toBe(true)
    expect(bookSummary.depth.minSide).toBe('280')
  })

  it('keeps the HIP-4 portfolio example executable', () => {
    const positions = createOutcomePositionRows({
      markets: normalizeOutcomeMeta(outcomeMeta),
      balances,
      marks: { '#200': '71%' },
    })

    expect(positions).toEqual([
      {
        market: 'USDH weekly volume clears $5m',
        outcome: 20,
        side: 0,
        sideName: 'Yes',
        coin: '#200',
        tokenName: '+200',
        quantity: '10.25',
        mark: '71%',
        state: 'held',
      },
    ])
  })
})
