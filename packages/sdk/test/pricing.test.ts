import { describe, expect, it } from 'vitest'

import { InvalidInputError, NetworkError } from '../src/errors.js'
import { applyPriceInverse, formatSpotPrice, midPrice18, parseDecimal } from '../src/pricing.js'
import type { L2Book } from '../src/transport/types.js'

describe('parseDecimal', () => {
  it('parses an integer', () => {
    expect(parseDecimal('1', 6)).toBe(1_000_000n)
  })

  it('parses a fractional part', () => {
    expect(parseDecimal('1.0001', 6)).toBe(1_000_100n)
    expect(parseDecimal('0.9999', 6)).toBe(999_900n)
  })

  it('truncates fractions beyond `decimals`', () => {
    expect(parseDecimal('1.123456789', 6)).toBe(1_123_456n)
  })

  it('handles zero decimals', () => {
    expect(parseDecimal('42', 0)).toBe(42n)
  })

  it('handles 18-decimal precision', () => {
    expect(parseDecimal('1.0001', 18)).toBe(1_000_100_000_000_000_000n)
  })

  it('rejects malformed strings', () => {
    expect(() => parseDecimal('abc', 6)).toThrow(InvalidInputError)
    expect(() => parseDecimal('1.2.3', 6)).toThrow(InvalidInputError)
    expect(() => parseDecimal('-1', 6)).toThrow(InvalidInputError)
    expect(() => parseDecimal('', 6)).toThrow(InvalidInputError)
  })

  it('rejects non-integer or negative decimals', () => {
    expect(() => parseDecimal('1', -1)).toThrow(InvalidInputError)
    expect(() => parseDecimal('1', 1.5)).toThrow(InvalidInputError)
  })
})

describe('midPrice18', () => {
  it('averages best bid and best ask', () => {
    const book: L2Book = {
      coin: 'USDH/USDC',
      time: 0,
      levels: [[{ px: '0.9998', sz: '10', n: 1 }], [{ px: '1.0002', sz: '10', n: 1 }]],
    }
    expect(midPrice18(book)).toBe(1_000_000_000_000_000_000n)
  })

  it('rejects a crossed book', () => {
    const crossed: L2Book = {
      coin: 'USDH/USDC',
      time: 0,
      levels: [[{ px: '1.0001', sz: '10', n: 1 }], [{ px: '0.9999', sz: '10', n: 1 }]],
    }
    expect(() => midPrice18(crossed)).toThrow(NetworkError)
  })

  it('throws when a side is empty', () => {
    const onlyBid: L2Book = {
      coin: 'USDH/USDC',
      time: 0,
      levels: [[{ px: '0.9998', sz: '10', n: 1 }], []],
    }
    expect(() => midPrice18(onlyBid)).toThrow(NetworkError)

    const onlyAsk: L2Book = {
      coin: 'USDH/USDC',
      time: 0,
      levels: [[], [{ px: '1.0002', sz: '10', n: 1 }]],
    }
    expect(() => midPrice18(onlyAsk)).toThrow(NetworkError)
  })
})

describe('applyPriceInverse', () => {
  it('converts amount through a unit price', () => {
    expect(applyPriceInverse(1_000_000n, 1_000_000_000_000_000_000n)).toBe(1_000_000n)
  })

  it('returns more target when price < 1 (USDH cheaper than USDC)', () => {
    expect(applyPriceInverse(1_000_000n, 999_900_000_000_000_000n)).toBe(1_000_100n)
  })

  it('returns less target when price > 1', () => {
    expect(applyPriceInverse(1_000_000n, 1_000_100_000_000_000_000n)).toBe(999_900n)
  })

  it('rejects non-positive price', () => {
    expect(() => applyPriceInverse(1n, 0n)).toThrow(InvalidInputError)
    expect(() => applyPriceInverse(1n, -1n)).toThrow(InvalidInputError)
  })
})

describe('formatSpotPrice', () => {
  it('caps spot prices to 5 significant figures', () => {
    expect(formatSpotPrice(parseDecimal('1234.5678', 18), 2)).toBe('1234.5')
    expect(formatSpotPrice(parseDecimal('0.000123456', 18), 0)).toBe('0.00012345')
  })

  it('caps spot price decimals using 8 - szDecimals', () => {
    expect(formatSpotPrice(parseDecimal('1.003', 18), 8)).toBe('1')
    expect(formatSpotPrice(parseDecimal('1.003', 18), 6)).toBe('1')
    expect(formatSpotPrice(parseDecimal('0.12345678', 18), 2)).toBe('0.12345')
  })

  it('rejects prices that truncate to zero', () => {
    expect(() => formatSpotPrice(parseDecimal('0.1', 18), 8)).toThrow(InvalidInputError)
  })
})
