import { describe, expect, it, vi } from 'vitest'

import { createDiscovery, findUsdhSpotPair, listUsdhSpotPairs } from '../src/discovery.js'
import { NetworkError } from '../src/errors.js'
import type { InfoClient } from '../src/transport/info.js'
import type { SpotMeta } from '../src/transport/types.js'

const meta: SpotMeta = {
  universe: [
    { name: 'USDH/USDC', tokens: [1, 0], index: 0, isCanonical: true },
    { name: 'HYPE/USDH', tokens: [2, 1], index: 5, isCanonical: true },
    { name: 'HYPE/USDC', tokens: [2, 0], index: 9, isCanonical: false },
  ],
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
    {
      name: 'HYPE',
      szDecimals: 2,
      weiDecimals: 8,
      index: 2,
      tokenId: '0xcccc',
      isCanonical: true,
    },
  ],
}

describe('listUsdhSpotPairs', () => {
  it('returns every pair where USDH is base or quote with explicit role', () => {
    expect(listUsdhSpotPairs(meta)).toEqual([
      {
        kind: 'spot',
        name: 'USDH/USDC',
        base: 'USDH',
        quote: 'USDC',
        usdhRole: 'base',
        index: 0,
        tokens: [1, 0],
      },
      {
        kind: 'spot',
        name: 'HYPE/USDH',
        base: 'HYPE',
        quote: 'USDH',
        usdhRole: 'quote',
        index: 5,
        tokens: [2, 1],
      },
    ])
  })

  it('skips pairs that do not involve USDH', () => {
    const pairs = listUsdhSpotPairs(meta)
    expect(pairs.find((p) => p.name === 'HYPE/USDC')).toBeUndefined()
  })

  it('throws when USDH is missing from spotMeta', () => {
    expect(() =>
      listUsdhSpotPairs({ ...meta, tokens: meta.tokens.filter((t) => t.name !== 'USDH') }),
    ).toThrow(NetworkError)
  })
})

describe('findUsdhSpotPair', () => {
  it('finds a pair with USDH as base', () => {
    expect(findUsdhSpotPair(meta, { base: 'USDH', quote: 'USDC' }).usdhRole).toBe('base')
  })

  it('finds a pair with USDH as quote', () => {
    expect(findUsdhSpotPair(meta, { base: 'HYPE', quote: 'USDH' }).usdhRole).toBe('quote')
  })

  it('rejects orientation flips even when the reverse pair exists', () => {
    expect(() => findUsdhSpotPair(meta, { base: 'USDC', quote: 'USDH' })).toThrow(NetworkError)
  })

  it('rejects pairs that do not involve USDH', () => {
    expect(() => findUsdhSpotPair(meta, { base: 'HYPE', quote: 'USDC' })).toThrow(
      /USDH as base or quote/,
    )
  })
})

describe('createDiscovery', () => {
  function stubInfo(overrides: Partial<InfoClient> = {}): InfoClient {
    return {
      spotMeta: vi.fn(async () => meta),
      l2Book: vi.fn(),
      spotClearinghouseState: vi.fn(),
      allMids: vi.fn(),
      ...overrides,
    }
  }

  it('caches spotMeta across listPairs and getPair calls', async () => {
    const info = stubInfo()
    const discovery = createDiscovery(info)
    await discovery.listPairs()
    await discovery.getPair({ base: 'HYPE', quote: 'USDH' })
    await discovery.listPairs({ quote: 'USDH' })
    expect(info.spotMeta).toHaveBeenCalledOnce()
  })

  it('filters listPairs to USDH-quote pairs when requested', async () => {
    const discovery = createDiscovery(stubInfo())
    expect((await discovery.listPairs({ quote: 'USDH' })).map((p) => p.name)).toEqual(['HYPE/USDH'])
  })

  it('rejects unsupported pair kinds', async () => {
    const discovery = createDiscovery(stubInfo())
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
      discovery.listPairs({ kind: 'hip3' as any }),
    ).rejects.toThrow(NetworkError)
  })

  it('forwards getBook to info.l2Book with nSigFigs', async () => {
    const l2Book = vi.fn(async () => ({ coin: 'USDH/USDC', time: 1, levels: [[], []] }))
    const discovery = createDiscovery(stubInfo({ l2Book }))
    await discovery.getBook('USDH/USDC', { nSigFigs: 5 })
    expect(l2Book).toHaveBeenCalledWith('USDH/USDC', 5)
  })

  it('returns the raw allMids map when no quote filter is set', async () => {
    const allMids = vi.fn(async () => ({ BTC: '60000', '@0': '1.0001' }))
    const discovery = createDiscovery(stubInfo({ allMids }))
    expect(await discovery.getMids()).toEqual({ BTC: '60000', '@0': '1.0001' })
  })

  it('filters mids to USDH-quote pairs and rekeys by pair name', async () => {
    const allMids = vi.fn(async () => ({
      BTC: '60000',
      '@0': '1.0001',
      '@5': '42.5',
    }))
    const discovery = createDiscovery(stubInfo({ allMids }))
    expect(await discovery.getMids({ quote: 'USDH' })).toEqual({ 'HYPE/USDH': '42.5' })
  })
})
