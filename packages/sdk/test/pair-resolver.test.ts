import { describe, expect, it, vi } from 'vitest'

import { NetworkError } from '../src/errors.js'
import { createPairResolver, findUsdhUsdcPair } from '../src/pair-resolver.js'
import type { InfoClient } from '../src/transport/info.js'
import type { SpotMeta } from '../src/transport/types.js'

const meta: SpotMeta = {
  universe: [{ name: '@230', tokens: [1, 0], index: 230, isCanonical: false }],
  tokens: [
    {
      name: 'USDC',
      szDecimals: 8,
      weiDecimals: 8,
      index: 0,
      tokenId: '0xaaaa',
      isCanonical: true,
    },
    {
      name: 'USDH',
      szDecimals: 8,
      weiDecimals: 8,
      index: 1,
      tokenId: '0xbbbb',
      isCanonical: true,
    },
  ],
}

describe('findUsdhUsdcPair', () => {
  it('finds the canonical pair with token decimals', () => {
    expect(findUsdhUsdcPair(meta)).toEqual({
      name: '@230',
      index: 230,
      assetIndex: 10230,
      tokens: [1, 0],
      baseSzDecimals: 8,
      quoteWeiDecimals: 8,
    })
  })

  it('throws when USDC is missing', () => {
    expect(() =>
      findUsdhUsdcPair({ ...meta, tokens: meta.tokens.filter((t) => t.name !== 'USDC') }),
    ).toThrow(NetworkError)
  })

  it('throws when USDH is missing', () => {
    expect(() =>
      findUsdhUsdcPair({ ...meta, tokens: meta.tokens.filter((t) => t.name !== 'USDH') }),
    ).toThrow(NetworkError)
  })

  it('throws when no pair links the two tokens', () => {
    expect(() => findUsdhUsdcPair({ ...meta, universe: [] })).toThrow(NetworkError)
  })

  it('throws when the only pair has the unsupported reverse orientation', () => {
    const reversed: SpotMeta = {
      ...meta,
      universe: [{ name: 'USDC/USDH', tokens: [0, 1], index: 0, isCanonical: true }],
    }
    expect(() => findUsdhUsdcPair(reversed)).toThrow(/USDH as base and USDC as quote/)
  })

  it('reads pair.index from spotMeta, not the array position', () => {
    const mainnetLike: SpotMeta = {
      ...meta,
      universe: [{ name: '@230', tokens: [1, 0], index: 230, isCanonical: false }],
    }
    const resolved = findUsdhUsdcPair(mainnetLike)
    expect(resolved.index).toBe(230)
    expect(resolved.assetIndex).toBe(10_230)
  })

  it('resolves token metadata by token.index instead of array position', () => {
    const sparse: SpotMeta = {
      universe: [{ name: '@1338', tokens: [1452, 0], index: 1338, isCanonical: false }],
      tokens: [
        {
          name: 'USDC',
          szDecimals: 8,
          weiDecimals: 8,
          index: 0,
          tokenId: '0xaaaa',
          isCanonical: true,
        },
        {
          name: 'USDH',
          szDecimals: 2,
          weiDecimals: 8,
          index: 1452,
          tokenId: '0xbbbb',
          isCanonical: false,
        },
      ],
    }

    expect(findUsdhUsdcPair(sparse)).toMatchObject({
      name: '@1338',
      baseSzDecimals: 2,
      quoteWeiDecimals: 8,
    })
  })
})

describe('createPairResolver', () => {
  function stubInfo(): InfoClient {
    return {
      spotMeta: vi.fn(async () => meta),
      l2Book: vi.fn(),
      spotClearinghouseState: vi.fn(),
      allMids: vi.fn(),
    }
  }

  it('caches the resolved pair across calls', async () => {
    const info = stubInfo()
    const resolve = createPairResolver(info)
    const a = await resolve()
    const b = await resolve()
    expect(a).toBe(b)
    expect(info.spotMeta).toHaveBeenCalledOnce()
  })
})
