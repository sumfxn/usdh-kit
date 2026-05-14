import { describe, expect, it } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import {
  createOrderTicketDraft,
  createOutcomeEventData,
  createOutcomeMarketRows,
  createOutcomeOrderBookLevels,
  createOutcomeOrderBookSummary,
  createOutcomePositionData,
  createOutcomePositionDataFromSide,
  createOutcomePositionRows,
  createOutcomeSideSelection,
  createQuoteReadiness,
  createQuoteSummaryData,
  createSpotOrderDraft,
  findOutcomeMarketSide,
  findOutcomeMarketSideFromBalance,
  normalizeOutcomeMeta,
  probabilityFromBook,
  resolveOutcomeMarketSide,
  resolveOutcomeSide,
} from '../src/index.js'
import type { UsdhOutcomeMarket } from '../src/outcomes.js'
import type { L2Book, OutcomeMeta } from '../src/transport/types.js'

const sampleMeta: OutcomeMeta = {
  outcomes: [
    {
      outcome: 20,
      name: 'BTC closes above 100k Friday',
      description: 'class:priceBinary|underlying:BTC|targetPrice:100000',
      sideSpecs: [{ name: 'Yes' }, { name: 'No' }],
    },
    {
      outcome: 24,
      name: 'HYPE weekly close green',
      description: 'class:directional|underlying:HYPE|window:weekly',
      sideSpecs: [{ name: 'Up' }, { name: 'Down' }],
    },
  ],
}

const usdhBook: L2Book = {
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

const outcomeBook: L2Book = {
  coin: '#200',
  time: 1778427457824,
  levels: [
    [
      { px: '0.69', sz: '100', n: 1 },
      { px: '0.68', sz: '50', n: 1 },
    ],
    [
      { px: '0.72', sz: '25', n: 1 },
      { px: '0.73', sz: '10', n: 1 },
    ],
  ],
}

function sampleMarkets(): [UsdhOutcomeMarket, UsdhOutcomeMarket] {
  const [market, directionalMarket] = normalizeOutcomeMeta(sampleMeta)
  if (market === undefined || directionalMarket === undefined) {
    throw new Error('missing normalized sample outcome markets')
  }
  return [market, directionalMarket]
}

describe('builder pattern helpers', () => {
  it('creates a quote readiness contract from a USDH book', () => {
    const readiness = createQuoteReadiness({
      pair: { name: '@230', label: 'USDH/USDC' },
      book: usdhBook,
      maxSpreadBps: 5,
      minSideDepth: 20_000,
      depthLevels: 2,
    })

    expect(readiness.ready).toBe(true)
    expect(readiness.pair).toBe('USDH/USDC')
    expect(readiness.bestBid).toBe('0.9999')
    expect(readiness.bestAsk).toBe('1.0001')
    expect(readiness.spreadBps).toBeCloseTo(2, 1)
    expect(readiness.depth).toEqual({ levels: 2, bid: '28k', ask: '23k' })
  })

  it('blocks quote readiness on missing or unhealthy books', () => {
    expect(createQuoteReadiness({ pair: null, book: usdhBook }).blockReason).toBe('missing_pair')
    expect(createQuoteReadiness({ pair: '@230', book: null }).blockReason).toBe('empty_book')
    expect(
      createQuoteReadiness({
        pair: '@230',
        book: {
          ...usdhBook,
          levels: [[{ px: '1.01', sz: '10', n: 1 }], [{ px: '1.00', sz: '10', n: 1 }]],
        },
      }).blockReason,
    ).toBe('crossed_book')
    expect(
      createQuoteReadiness({ pair: '@230', book: usdhBook, minSideDepth: 100_000 }).blockReason,
    ).toBe('thin_depth')
  })

  it('creates quote summary data with estimated receive for swap surfaces', () => {
    const summary = createQuoteSummaryData({
      pair: { name: '@230', base: 'USDH', quote: 'USDC', label: 'USDH/USDC' },
      book: usdhBook,
      amount: '250',
      payAsset: 'USDC',
      maxSpreadBps: 5,
      minSideDepth: 20_000,
    })

    expect(summary).toMatchObject({
      pair: 'USDH/USDC',
      ready: true,
      side: 'buy',
      price: '1.0001',
      pay: { asset: 'USDC', amount: '250' },
      receive: { asset: 'USDH', amount: '249.975002' },
    })

    expect(
      createQuoteSummaryData({
        pair: 'USDH/USDC',
        book: usdhBook,
        amount: '250',
        payAsset: 'USDH',
        receiveDecimals: 3,
      }).receive,
    ).toEqual({ asset: 'USDC', amount: '249.975' })
  })

  it('keeps builder quote and ticket math exact beyond Number safe integers', () => {
    const oneDollarBook = {
      ...usdhBook,
      levels: [
        [{ px: '1', sz: '10000000000000000', n: 1 }],
        [{ px: '1', sz: '10000000000000000', n: 1 }],
      ],
    } satisfies L2Book

    expect(
      createQuoteSummaryData({
        pair: { name: '@230', base: 'USDH', quote: 'USDC', label: 'USDH/USDC' },
        book: oneDollarBook,
        amount: '9007199254740993',
        payAsset: 'USDC',
        receiveDecimals: 0,
      }).receive,
    ).toEqual({ asset: 'USDH', amount: '9007199254740993' })

    expect(
      createSpotOrderDraft({
        pair: 'USDH/USDC',
        side: 'buy',
        size: '9007199254740993',
        price: '1',
        availableQuote: '9007199254740992',
      }).blockReason,
    ).toBe('insufficient_balance')
  })

  it('blocks quote summary data when the amount or route is not usable', () => {
    expect(
      createQuoteSummaryData({
        pair: 'USDH/USDC',
        book: usdhBook,
        amount: null,
        payAsset: 'USDC',
      }).blockReason,
    ).toBe('missing_amount')
    expect(
      createQuoteSummaryData({
        pair: '@230',
        book: usdhBook,
        amount: '250',
        payAsset: 'USDC',
      }).blockReason,
    ).toBe('unsupported_route')
    expect(
      createQuoteSummaryData({
        pair: { name: '@230', base: 'USDH', quote: 'USDC', label: 'USDH/USDC' },
        book: usdhBook,
        amount: '250',
        payAsset: 'USDC',
        maxSpreadBps: 1,
      }).blockReason,
    ).toBe('wide_spread')
  })

  it('creates a signer-ready order ticket draft without submitting writes', () => {
    const readiness = createQuoteReadiness({
      pair: 'USDH/USDC',
      book: usdhBook,
      maxSpreadBps: 5,
      minSideDepth: 20_000,
      depthLevels: 2,
    })
    const draft = createSpotOrderDraft({
      pair: 'USDH/USDC',
      side: 'buy',
      size: '25',
      price: '1.0001',
      readiness,
      tif: 'Gtc',
    })

    expect(draft.canReview).toBe(true)
    expect(draft.blockReason).toBeUndefined()
    expect(draft.notional).toBe('25')
    expect(draft.placeOrderInput).toEqual({
      pair: 'USDH/USDC',
      side: 'buy',
      size: '25',
      price: '1.0001',
      tif: 'Gtc',
    })
  })

  it('keeps the order-ticket helper as an alias for spot order drafts', () => {
    expect(createOrderTicketDraft).toBe(createSpotOrderDraft)
  })

  it('blocks order ticket drafts before the wallet handoff when inputs are unsafe', () => {
    expect(
      createSpotOrderDraft({
        pair: null,
        side: 'buy',
        size: '25',
        price: '1',
      }).blockReason,
    ).toBe('missing_pair')
    expect(
      createSpotOrderDraft({
        pair: 'USDH/USDC',
        side: 'buy',
        size: '5',
        price: '1',
        minNotional: 10,
      }).blockReason,
    ).toBe('below_min_notional')
    expect(
      createSpotOrderDraft({
        pair: 'USDH/USDC',
        side: 'buy',
        size: '25',
        price: '1',
        readiness: createQuoteReadiness({ pair: 'USDH/USDC', book: null }),
      }).blockReason,
    ).toBe('quote_not_ready')
  })

  it('validates spot order draft precision, TIF, slippage, and balances', () => {
    expect(
      createSpotOrderDraft({
        pair: 'USDH/USDC',
        side: 'buy',
        size: '25.123',
        price: '1',
        sizeDecimals: 2,
      }).blockReason,
    ).toBe('size_precision')
    expect(
      createSpotOrderDraft({
        pair: 'USDH/USDC',
        side: 'buy',
        size: '25',
        price: '1.000123',
        priceDecimals: 4,
      }).blockReason,
    ).toBe('price_precision')
    expect(
      createSpotOrderDraft({
        pair: 'USDH/USDC',
        side: 'buy',
        size: '25',
        mode: 'market',
        tif: 'Gtc',
      }).blockReason,
    ).toBe('invalid_tif')
    expect(
      createSpotOrderDraft({
        pair: 'USDH/USDC',
        side: 'buy',
        size: '25',
        price: '1',
        slippageBps: 30,
      }).blockReason,
    ).toBe('invalid_slippage')
    expect(
      createSpotOrderDraft({
        pair: 'USDH/USDC',
        side: 'sell',
        size: '25',
        price: '1',
        availableBase: '10',
      }).blockReason,
    ).toBe('insufficient_balance')
  })

  it('supports market order drafts while keeping final pricing in the order layer', () => {
    const readiness = createQuoteReadiness({ pair: 'USDH/USDC', book: usdhBook })
    const draft = createSpotOrderDraft({
      pair: 'USDH/USDC',
      side: 'sell',
      size: '25',
      mode: 'market',
      readiness,
      slippageBps: 30,
    })

    expect(draft.canReview).toBe(true)
    expect(draft.mode).toBe('market')
    expect(draft.notional).toBe('25')
    expect(draft.placeOrderInput).toEqual({
      pair: 'USDH/USDC',
      side: 'sell',
      size: '25',
      slippageBps: 30,
    })
  })

  it('creates outcome event data from normalized HIP-4 metadata and side books', () => {
    const [market] = sampleMarkets()
    const event = createOutcomeEventData(market, [{ book: outcomeBook }])

    expect(event.title).toBe('BTC closes above 100k Friday')
    expect(event.subtitle).toBe('Yes / No')
    expect(event.sides[0]).toMatchObject({
      side: 0,
      label: 'Yes',
      coin: '#200',
      tokenName: '+200',
      probability: 71,
      bestBid: '0.69',
      bestAsk: '0.72',
      depth: '185',
    })
    expect(event.sides[1]).toMatchObject({
      side: 1,
      label: 'No',
      coin: '#201',
      probability: null,
    })
  })

  it('creates outcome order-book rows with normalized depth percentages', () => {
    const levels = createOutcomeOrderBookLevels(outcomeBook)

    expect(levels.bids[0]).toEqual({ price: '0.69', size: '100', depthPct: 100 })
    expect(levels.asks[0]).toEqual({ price: '0.72', size: '25', depthPct: 25 })
  })

  it('creates a side book summary with health and depth context', () => {
    const summary = createOutcomeOrderBookSummary(outcomeBook, { levels: 2 })

    expect(summary).toMatchObject({
      coin: '#200',
      ready: true,
      bestBid: '0.69',
      bestAsk: '0.72',
      depth: { levels: 2, bid: '150', ask: '35', minSide: '35' },
    })
    expect(summary.spreadBps).toBeCloseTo(425.5, 1)
    expect(
      createOutcomeOrderBookSummary({
        ...outcomeBook,
        levels: [[{ px: '0.73', sz: '10' }], [{ px: '0.72', sz: '10' }]],
      }).blockReason,
    ).toBe('crossed_book')
    expect(
      createOutcomeOrderBookSummary({
        coin: '#200',
        levels: [[], []],
      }).blockReason,
    ).toBe('empty_book')
  })

  it('creates outcome market rows from market metadata and side reads', () => {
    const markets = normalizeOutcomeMeta(sampleMeta)
    const rows = createOutcomeMarketRows({
      markets,
      readsByCoin: {
        '#200': { probability: 70, bestBid: '0.69', bestAsk: '0.72' },
        '+201': { probability: 31, bestBid: '0.30', bestAsk: '0.33' },
        '#240': { probability: 55, bestBid: '0.54', bestAsk: '0.57' },
        '100000241': { probability: 48, bestBid: '0.47', bestAsk: '0.50' },
      },
      sortBy: 'probability',
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: 20,
      title: 'BTC closes above 100k Friday',
      sides: [
        { coin: '#200', probability: 70 },
        { coin: '#201', probability: 31 },
      ],
    })
    expect(rows[1]).toMatchObject({
      id: 24,
      title: 'HYPE weekly close green',
      subtitle: 'Up / Down',
      sides: [
        { coin: '#240', probability: 55 },
        { coin: '#241', probability: 48 },
      ],
    })
  })

  it('creates a controlled outcome side selection contract', () => {
    const [market, directionalMarket] = sampleMarkets()
    const selection = createOutcomeSideSelection({
      market,
      selected: '+201',
      reads: [{ book: outcomeBook }, { probability: 29, bestBid: '0.28', bestAsk: '0.31' }],
    })

    expect(selection).toMatchObject({
      selectedIndex: 1,
      selectedCoin: '#201',
      selected: { label: 'No', coin: '#201', probability: 29 },
      event: { id: 20 },
    })
    expect(
      createOutcomeSideSelection({
        market: directionalMarket,
        selected: '+241',
      }),
    ).toMatchObject({
      selectedIndex: 1,
      selectedCoin: '#241',
      selected: { label: 'Down', coin: '#241' },
      event: { subtitle: 'Up / Down' },
    })
  })

  it('resolves outcome position data by side, coin, token name, or side object', () => {
    const [market] = sampleMarkets()
    const noSide = market.sides[1]
    if (noSide === undefined) throw new Error('missing no side')

    expect(createOutcomePositionData({ market, side: 0, quantity: '12.5' })).toMatchObject({
      market: 'BTC closes above 100k Friday',
      outcome: 20,
      side: 0,
      sideName: 'Yes',
      coin: '#200',
      quantity: '12.5',
      state: 'held',
    })
    expect(resolveOutcomeSide(market, '#201').name).toBe('No')
    expect(resolveOutcomeSide(market, '+200').name).toBe('Yes')
    expect(resolveOutcomeSide(market, noSide).coin).toBe('#201')
    expect(() => resolveOutcomeSide(market, '#999')).toThrow(InvalidInputError)
  })

  it('resolves held outcome side coins across a market list', () => {
    const markets = normalizeOutcomeMeta(sampleMeta)

    expect(findOutcomeMarketSide(markets, '#201')).toMatchObject({
      market: { outcome: 20 },
      side: { name: 'No', tokenName: '+201' },
    })
    expect(resolveOutcomeMarketSide(markets, '+200')).toMatchObject({
      market: { name: 'BTC closes above 100k Friday' },
      side: { name: 'Yes', coin: '#200' },
    })
    expect(
      createOutcomePositionDataFromSide({
        markets,
        side: '#201',
        quantity: '4.2',
        mark: '29%',
        state: 'watch',
      }),
    ).toMatchObject({
      market: 'BTC closes above 100k Friday',
      sideName: 'No',
      coin: '#201',
      quantity: '4.2',
      mark: '29%',
      state: 'watch',
    })
    expect(findOutcomeMarketSide(markets, '#999')).toBeNull()
    expect(() => resolveOutcomeMarketSide(markets, '#999')).toThrow(InvalidInputError)
  })

  it('creates outcome position rows from wallet balances', () => {
    const markets = normalizeOutcomeMeta(sampleMeta)
    const balances = [
      { coin: '+200', token: 100_000_200, total: '12.50', hold: '2.25' },
      { coin: 'USDC', token: 0, total: '100', hold: '0' },
      { coin: '#201', token: 100_000_201, total: '1', hold: '1' },
    ]

    const firstBalance = balances[0]
    if (firstBalance === undefined) throw new Error('missing test balance')
    expect(findOutcomeMarketSideFromBalance(markets, firstBalance)).toMatchObject({
      side: { coin: '#200' },
    })
    expect(
      createOutcomePositionRows({
        markets,
        balances,
        marks: { '#200': '71%', '+201': '29%' },
      }),
    ).toEqual([
      {
        market: 'BTC closes above 100k Friday',
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
    expect(
      createOutcomePositionRows({
        markets,
        balances,
        includeZero: true,
      }).map((row) => row.quantity),
    ).toEqual(['10.25', '0'])
  })

  it('keeps outcome position rows exact and ignores unrelated balances', () => {
    const markets = normalizeOutcomeMeta(sampleMeta)

    expect(
      createOutcomePositionRows({
        markets,
        balances: [
          {
            coin: '+240',
            token: 100_000_240,
            total: '0.300000000000000003',
            hold: '0.100000000000000001',
          },
          { coin: '+999', token: 100_000_999, total: '10', hold: '0' },
        ],
        marks: { '100000240': '55%' },
      }),
    ).toEqual([
      {
        market: 'HYPE weekly close green',
        outcome: 24,
        side: 0,
        sideName: 'Up',
        coin: '#240',
        tokenName: '+240',
        quantity: '0.200000000000000002',
        mark: '55%',
        state: 'held',
      },
    ])
  })

  it('returns null probability for invalid or crossed reads', () => {
    expect(probabilityFromBook({ bestBid: '0.70', bestAsk: '0.72' })).toBe(71)
    expect(probabilityFromBook({ bestBid: '0.73', bestAsk: '0.72' })).toBeNull()
    expect(probabilityFromBook({ bestBid: undefined, bestAsk: '0.72' })).toBeNull()
  })
})
