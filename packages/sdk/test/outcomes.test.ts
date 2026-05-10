import { describe, expect, it, vi } from 'vitest'

import { InvalidInputError, NetworkError } from '../src/errors.js'
import {
  createOutcomeDiscovery,
  normalizeOutcomeMeta,
  outcomeAssetId,
  outcomeCoin,
  outcomeEncoding,
  outcomeTokenName,
} from '../src/outcomes.js'
import type { InfoClient } from '../src/transport/info.js'
import type { L2Book, OutcomeMeta } from '../src/transport/types.js'

const maxOutcomeId = Math.floor((Number.MAX_SAFE_INTEGER - 100_000_000 - 1) / 10)

const sampleOutcomeMeta: OutcomeMeta = {
  outcomes: [
    {
      outcome: 20,
      name: 'Recurring',
      description: 'class:priceBinary|underlying:BTC|expiry:20260511-0600|targetPrice:80657',
      sideSpecs: [{ name: 'Yes' }, { name: 'No' }],
    },
  ],
  questions: [],
}

const sampleBook: L2Book = {
  coin: '#200',
  time: 1778427457824,
  levels: [[{ px: '0.73331', sz: '136.0', n: 1 }], [{ px: '0.73332', sz: '222.0', n: 2 }]],
}

function stubInfo(overrides: Partial<InfoClient> = {}): InfoClient {
  return {
    spotMeta: vi.fn(),
    outcomeMeta: vi.fn(async () => sampleOutcomeMeta),
    l2Book: vi.fn(async () => sampleBook),
    spotClearinghouseState: vi.fn(),
    allMids: vi.fn(async () => ({ '#200': '0.733315', '#201': '0.266685', BTC: '80657' })),
    ...overrides,
  }
}

describe('outcome encoding helpers', () => {
  it('derives the Hyperliquid coin, token name, and asset id', () => {
    expect(outcomeEncoding(20, 0)).toBe(200)
    expect(outcomeEncoding(20, 1)).toBe(201)
    expect(outcomeCoin(20, 0)).toBe('#200')
    expect(outcomeTokenName(20, 1)).toBe('+201')
    expect(outcomeAssetId(20, 1)).toBe(100_000_201)
  })

  it('accepts the maximum safe outcome id', () => {
    expect(outcomeAssetId(maxOutcomeId, 1)).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER)
  })

  it('rejects unsafe outcome ids and non-binary sides', () => {
    expect(() => outcomeEncoding(-1, 0)).toThrow(InvalidInputError)
    expect(() => outcomeEncoding(1.5, 0)).toThrow(InvalidInputError)
    expect(() => outcomeEncoding(maxOutcomeId + 1, 0)).toThrow(InvalidInputError)
    // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
    expect(() => outcomeEncoding(1, 2 as any)).toThrow(InvalidInputError)
  })
})

describe('outcome market reads', () => {
  it('normalizes outcomeMeta into market sides', () => {
    expect(normalizeOutcomeMeta(sampleOutcomeMeta)).toEqual([
      {
        outcome: 20,
        name: 'Recurring',
        description: 'class:priceBinary|underlying:BTC|expiry:20260511-0600|targetPrice:80657',
        descriptionFields: {
          class: 'priceBinary',
          underlying: 'BTC',
          expiry: '20260511-0600',
          targetPrice: '80657',
        },
        sides: [
          {
            side: 0,
            name: 'Yes',
            encoding: 200,
            coin: '#200',
            tokenName: '+200',
            assetId: 100_000_200,
          },
          {
            side: 1,
            name: 'No',
            encoding: 201,
            coin: '#201',
            tokenName: '+201',
            assetId: 100_000_201,
          },
        ],
      },
    ])
  })

  it('caches outcomeMeta across list and get calls', async () => {
    const info = stubInfo()
    const outcomes = createOutcomeDiscovery(info)
    await outcomes.listOutcomeMarkets()
    await outcomes.getOutcomeMarket({ outcome: 20 })
    expect(info.outcomeMeta).toHaveBeenCalledOnce()
  })

  it('fetches one outcome market by id', async () => {
    const outcomes = createOutcomeDiscovery(stubInfo())
    await expect(outcomes.getOutcomeMarket({ outcome: 20 })).resolves.toMatchObject({
      outcome: 20,
      sides: [{ coin: '#200' }, { coin: '#201' }],
    })
    await expect(outcomes.getOutcomeMarket({ outcome: 999 })).rejects.toThrow(NetworkError)
  })

  it('fetches the book for the encoded outcome side coin', async () => {
    const info = stubInfo()
    const outcomes = createOutcomeDiscovery(info)
    await expect(outcomes.getOutcomeBook({ outcome: 20, side: 0, nSigFigs: 5 })).resolves.toEqual(
      sampleBook,
    )
    expect(info.l2Book).toHaveBeenCalledWith('#200', 5)
  })

  it('propagates l2Book validation failures', async () => {
    const outcomes = createOutcomeDiscovery(
      stubInfo({
        l2Book: vi.fn(async () => {
          throw new NetworkError('invalid l2Book response for #200')
        }),
      }),
    )
    await expect(outcomes.getOutcomeBook({ outcome: 20, side: 0 })).rejects.toThrow(
      /invalid l2Book response/,
    )
  })

  it('filters allMids to encoded outcome side coins', async () => {
    const outcomes = createOutcomeDiscovery(stubInfo())
    await expect(outcomes.getOutcomeMids()).resolves.toEqual({
      '#200': '0.733315',
      '#201': '0.266685',
    })
  })
})
