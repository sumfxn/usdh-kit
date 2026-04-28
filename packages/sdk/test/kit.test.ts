import { describe, expect, it, vi } from 'vitest'

import { InvalidInputError, NotImplementedError, type Signer, createUsdhKit } from '../src/index.js'
import type { L2Book, SpotMeta } from '../src/transport/types.js'

const stubSigner: Signer = {
  address: '0x0000000000000000000000000000000000000001',
  signTypedData: async () => '0x' as const,
  signMessage: async () => '0x' as const,
}

const sampleSpotMeta: SpotMeta = {
  universe: [{ name: 'USDH/USDC', tokens: [1, 0], index: 0, isCanonical: true }],
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

const sampleL2Book: L2Book = {
  coin: 'USDH/USDC',
  time: 1735300000000,
  levels: [[{ px: '0.9998', sz: '10000', n: 1 }], [{ px: '1.0002', sz: '10000', n: 1 }]],
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function makeFetch(handler: (body: Record<string, unknown>) => unknown): typeof fetch {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    return jsonResponse(handler(body))
  }) as unknown as typeof fetch
}

describe('createUsdhKit', () => {
  it('binds the configured network', () => {
    const kit = createUsdhKit({ network: 'testnet', signer: stubSigner })
    expect(kit.network).toBe('testnet')
  })

  it('rejects an invalid network', () => {
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
      createUsdhKit({ network: 'devnet' as any, signer: stubSigner }),
    ).toThrow(InvalidInputError)
  })

  it('rejects a missing signer', () => {
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
      createUsdhKit({ network: 'mainnet', signer: undefined as any }),
    ).toThrow(InvalidInputError)
  })

  it('rejects out-of-range slippage', () => {
    expect(() =>
      createUsdhKit({ network: 'mainnet', signer: stubSigner, slippageBps: -1 }),
    ).toThrow(InvalidInputError)
    expect(() =>
      createUsdhKit({ network: 'mainnet', signer: stubSigner, slippageBps: 10_001 }),
    ).toThrow(InvalidInputError)
  })
})

describe('swap', () => {
  const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner })

  it('validates the source stable', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
    await expect(kit.swap({ from: 'DAI' as any, amount: 1n })).rejects.toThrow(InvalidInputError)
  })

  it('validates the amount', async () => {
    await expect(kit.swap({ from: 'USDC', amount: 0n })).rejects.toThrow(InvalidInputError)
  })

  it('throws NotImplementedError for valid input', async () => {
    await expect(kit.swap({ from: 'USDC', amount: 1_000_000n })).rejects.toThrow(
      NotImplementedError,
    )
  })
})

describe('getQuote', () => {
  it('returns USDH estimate from the orderbook mid-price', async () => {
    const fetch = makeFetch((body) => {
      if (body.type === 'spotMeta') return sampleSpotMeta
      if (body.type === 'l2Book') return sampleL2Book
      throw new Error(`unexpected body: ${JSON.stringify(body)}`)
    })
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    const quote = await kit.getQuote({ from: 'USDC', amount: 1_000_000n })
    expect(quote.pair).toBe('USDH/USDC')
    expect(quote.midPrice).toBe(1_000_000_000_000_000_000n)
    expect(quote.estimatedReceived).toBe(1_000_000n)
    expect(quote.validUntil).toBeGreaterThan(Date.now())
  })

  it('caches the pair resolution across quote calls', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string) as { type: string }
      return jsonResponse(body.type === 'spotMeta' ? sampleSpotMeta : sampleL2Book)
    }) as unknown as typeof fetch
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    await kit.getQuote({ from: 'USDC', amount: 1_000_000n })
    await kit.getQuote({ from: 'USDC', amount: 2_000_000n })
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls
    const types = calls.map(
      ([, init]: unknown[]) => JSON.parse((init as RequestInit).body as string).type as string,
    )
    expect(types).toEqual(['spotMeta', 'l2Book', 'l2Book'])
  })

  it('throws NotImplementedError for USDT until the double-hop is wired', async () => {
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner })
    await expect(kit.getQuote({ from: 'USDT', amount: 1_000_000n })).rejects.toThrow(
      NotImplementedError,
    )
  })

  it('validates input before contacting the network', async () => {
    const fetch = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    await expect(kit.getQuote({ from: 'USDC', amount: 0n })).rejects.toThrow(InvalidInputError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
