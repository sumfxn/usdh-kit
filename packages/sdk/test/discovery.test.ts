import { describe, expect, it, vi } from 'vitest'

import { createDiscovery, findUsdhSpotPair, listUsdhSpotPairs } from '../src/discovery.js'
import { NetworkError } from '../src/errors.js'
import type { InfoClient } from '../src/transport/info.js'
import type { L2Book, SpotMeta } from '../src/transport/types.js'

const meta: SpotMeta = {
  universe: [
    { name: '@230', tokens: [1, 0], index: 230, isCanonical: false },
    { name: '@232', tokens: [2, 1], index: 232, isCanonical: false },
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
        name: '@230',
        base: 'USDH',
        quote: 'USDC',
        usdhRole: 'base',
        index: 230,
        tokens: [1, 0],
      },
      {
        kind: 'spot',
        name: '@232',
        base: 'HYPE',
        quote: 'USDH',
        usdhRole: 'quote',
        index: 232,
        tokens: [2, 1],
      },
    ])
  })

  it('resolves sparse token indices by token.index rather than array position', () => {
    const sparse: SpotMeta = {
      universe: [{ name: '@1415', tokens: [1540, 1452], index: 1415, isCanonical: false }],
      tokens: [
        {
          name: 'SALMON',
          szDecimals: 2,
          weiDecimals: 8,
          index: 1544,
          tokenId: '0xaaaa',
          isCanonical: false,
        },
        {
          name: 'USDH',
          szDecimals: 2,
          weiDecimals: 8,
          index: 1452,
          tokenId: '0xbbbb',
          isCanonical: false,
        },
        {
          name: 'RUBT',
          szDecimals: 1,
          weiDecimals: 6,
          index: 1540,
          tokenId: '0xcccc',
          isCanonical: false,
        },
      ],
    }

    expect(listUsdhSpotPairs(sparse)).toEqual([
      {
        kind: 'spot',
        name: '@1415',
        base: 'RUBT',
        quote: 'USDH',
        usdhRole: 'quote',
        index: 1415,
        tokens: [1540, 1452],
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
      outcomeMeta: vi.fn(),
      l2Book: vi.fn(),
      spotClearinghouseState: vi.fn(),
      allMids: vi.fn(),
      frontendOpenOrders: vi.fn(),
      orderStatus: vi.fn(),
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

  it('defaults listPairs to USDC-quoted pairs', async () => {
    const discovery = createDiscovery(stubInfo())
    // @230 = USDH/USDC (quote USDC) and HYPE/USDC (quote USDC) are both USDC-quoted.
    expect((await discovery.listPairs()).map((p) => p.name)).toEqual(['@230', 'HYPE/USDC'])
  })

  it('returns USDC-quoted pairs when quote is explicitly USDC', async () => {
    const discovery = createDiscovery(stubInfo())
    expect((await discovery.listPairs({ quote: 'USDC' })).map((p) => p.name)).toEqual([
      '@230',
      'HYPE/USDC',
    ])
  })

  it('filters listPairs to USDH-quote pairs when requested (legacy path)', async () => {
    const discovery = createDiscovery(stubInfo())
    expect((await discovery.listPairs({ quote: 'USDH' })).map((p) => p.name)).toEqual(['@232'])
  })

  it('resolves getPair for a non-USDH pair (HYPE/USDC)', async () => {
    const discovery = createDiscovery(stubInfo())
    const pair = await discovery.getPair({ base: 'HYPE', quote: 'USDC' })
    expect(pair.name).toBe('HYPE/USDC')
    expect(pair.base).toBe('HYPE')
    expect(pair.quote).toBe('USDC')
    expect(pair.usdhRole).toBeUndefined()
  })

  it('resolves getPair for USDH-bearing pairs (legacy)', async () => {
    const discovery = createDiscovery(stubInfo())
    const pair = await discovery.getPair({ base: 'HYPE', quote: 'USDH' })
    expect(pair.usdhRole).toBe('quote')
  })

  it('rejects unsupported pair kinds', async () => {
    const discovery = createDiscovery(stubInfo())
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
      discovery.listPairs({ kind: 'hip3' as any }),
    ).rejects.toThrow(NetworkError)
  })

  it('forwards getBook to info.l2Book with nSigFigs', async () => {
    const l2Book = vi.fn(
      async (): Promise<L2Book> => ({ coin: 'USDH/USDC', time: 1, levels: [[], []] }),
    )
    const discovery = createDiscovery(stubInfo({ l2Book }))
    await discovery.getBook('USDH/USDC', { nSigFigs: 5 })
    expect(l2Book).toHaveBeenCalledWith('USDH/USDC', 5)
  })

  it('defaults getMids to USDC-quoted pairs', async () => {
    const allMids = vi.fn(async () => ({ BTC: '60000', '@230': '1.0001', 'HYPE/USDC': '28.5' }))
    const discovery = createDiscovery(stubInfo({ allMids }))
    // @230 (USDH/USDC) and HYPE/USDC are both USDC-quoted in the fixture.
    expect(await discovery.getMids()).toEqual({ '@230': '1.0001', 'HYPE/USDC': '28.5' })
  })

  it('filters mids to USDC-quoted pairs when quote is explicitly USDC', async () => {
    const allMids = vi.fn(async () => ({ 'HYPE/USDC': '28.5', '@232': '42.5' }))
    const discovery = createDiscovery(stubInfo({ allMids }))
    expect(await discovery.getMids({ quote: 'USDC' })).toEqual({ 'HYPE/USDC': '28.5' })
  })

  it('filters mids to USDH-quote pairs and rekeys by pair name (legacy)', async () => {
    const allMids = vi.fn(async () => ({
      BTC: '60000',
      '@230': '1.0001',
      '@232': '42.5',
    }))
    const discovery = createDiscovery(stubInfo({ allMids }))
    expect(await discovery.getMids({ quote: 'USDH' })).toEqual({ '@232': '42.5' })
  })
})
