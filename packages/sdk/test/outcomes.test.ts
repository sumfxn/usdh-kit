import { describe, expect, it, vi } from 'vitest'

import { InvalidInputError, NetworkError } from '../src/errors.js'
import {
  getOutcomeBook,
  getOutcomeMarket,
  listOutcomeMarkets,
  outcomeAssetId,
  outcomeCoin,
  outcomeEncoding,
  outcomeTokenName,
} from '../src/outcomes.js'
import type { InfoClient } from '../src/transport/info.js'
import type { L2Book, OutcomeMeta } from '../src/transport/types.js'

const sampleOutcomeMeta: OutcomeMeta = {
  outcomes: [
    {
      outcome: 123,
      name: 'Recurring',
      description: 'class:priceBinary|underlying:HYPE|expiry:20260310-1100|targetPrice:34.5',
      sideSpecs: [{ name: 'Yes' }, { name: 'No' }],
    },
  ],
  questions: [],
}

const sampleBook: L2Book = {
  coin: '#1230',
  time: 1735300000000,
  levels: [[{ px: '0.42', sz: '100', n: 1 }], [{ px: '0.43', sz: '100', n: 1 }]],
}

function stubInfo(meta: OutcomeMeta = sampleOutcomeMeta): InfoClient {
  return {
    spotMeta: vi.fn(),
    outcomeMeta: vi.fn(async () => meta),
    l2Book: vi.fn(async () => sampleBook),
    spotClearinghouseState: vi.fn(),
  }
}

describe('outcome encoding helpers', () => {
  it('derives the Hyperliquid coin, token name, and asset id', () => {
    expect(outcomeEncoding(123, 0)).toBe(1230)
    expect(outcomeEncoding(123, 1)).toBe(1231)
    expect(outcomeCoin(123, 0)).toBe('#1230')
    expect(outcomeTokenName(123, 1)).toBe('+1231')
    expect(outcomeAssetId(123, 1)).toBe(100_001_231)
  })

  it('validates outcome ids and binary sides', () => {
    expect(() => outcomeEncoding(-1, 0)).toThrow(InvalidInputError)
    expect(() => outcomeEncoding(1.5, 0)).toThrow(InvalidInputError)
    expect(() => outcomeEncoding(1, 2 as 0)).toThrow(InvalidInputError)
  })
})

describe('outcome market reads', () => {
  it('normalizes outcomeMeta into market sides', async () => {
    const info = stubInfo()
    const markets = await listOutcomeMarkets(info)

    expect(markets).toEqual([
      {
        outcome: 123,
        name: 'Recurring',
        description: 'class:priceBinary|underlying:HYPE|expiry:20260310-1100|targetPrice:34.5',
        descriptionFields: {
          class: 'priceBinary',
          underlying: 'HYPE',
          expiry: '20260310-1100',
          targetPrice: '34.5',
        },
        sides: [
          {
            side: 0,
            name: 'Yes',
            encoding: 1230,
            coin: '#1230',
            tokenName: '+1230',
            assetId: 100_001_230,
          },
          {
            side: 1,
            name: 'No',
            encoding: 1231,
            coin: '#1231',
            tokenName: '+1231',
            assetId: 100_001_231,
          },
        ],
      },
    ])
  })

  it('fetches one outcome market by id', async () => {
    await expect(getOutcomeMarket(stubInfo(), { outcome: 123 })).resolves.toMatchObject({
      outcome: 123,
      sides: [{ coin: '#1230' }, { coin: '#1231' }],
    })
    await expect(getOutcomeMarket(stubInfo(), { outcome: 999 })).rejects.toThrow(NetworkError)
  })

  it('fetches the book for the encoded outcome side coin', async () => {
    const info = stubInfo()
    await expect(getOutcomeBook(info, { outcome: 123, side: 0, nSigFigs: 5 })).resolves.toEqual(
      sampleBook,
    )
    expect(info.l2Book).toHaveBeenCalledWith('#1230', 5)
  })
})
