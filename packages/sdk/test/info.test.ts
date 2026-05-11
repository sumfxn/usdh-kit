import { describe, expect, it, vi } from 'vitest'

import { InvalidInputError, NetworkError } from '../src/errors.js'
import { createInfoClient } from '../src/transport/info.js'
import type { L2Book, OutcomeMeta, SpotMeta } from '../src/transport/types.js'

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

const sampleSpotMeta: SpotMeta = {
  universe: [{ name: 'USDH/USDC', tokens: [1, 0], index: 0, isCanonical: true }],
  tokens: [
    {
      name: 'USDC',
      szDecimals: 8,
      weiDecimals: 8,
      index: 0,
      tokenId: '0x6d1e7cde53ba9467b783cb7c530ce054',
      isCanonical: true,
    },
    {
      name: 'USDH',
      szDecimals: 8,
      weiDecimals: 8,
      index: 1,
      tokenId: '0xeb62eee3685fc4c43992febcd9e75443',
      isCanonical: true,
    },
  ],
}

const sampleL2Book: L2Book = {
  coin: '@230',
  time: 1735300000000,
  levels: [[{ px: '0.9998', sz: '10000', n: 1 }], [{ px: '1.0001', sz: '10000', n: 1 }]],
}

const sampleOutcomeMeta: OutcomeMeta = {
  outcomes: [
    {
      outcome: 20,
      name: 'Recurring',
      description: 'class:priceBinary|underlying:BTC|expiry:20260511-0600|targetPrice:80657',
      sideSpecs: [{ name: 'Yes' }, { name: 'No' }],
    },
  ],
  questions: [
    {
      question: 3,
      name: 'Recurring',
      description: 'class:priceBucket|underlying:BTC|expiry:20260511-0600',
      fallbackOutcome: 21,
      namedOutcomes: [22, 23, 24],
      settledNamedOutcomes: [],
    },
  ],
}

describe('createInfoClient', () => {
  it('falls back to globalThis.fetch when no fetch is provided', () => {
    expect(() => createInfoClient({ network: 'mainnet' })).not.toThrow()
  })

  it('rejects an invalid network synchronously', () => {
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
      createInfoClient({ network: 'devnet' as any }),
    ).toThrow(InvalidInputError)
  })

  it('rejects non-positive timeouts synchronously', () => {
    expect(() => createInfoClient({ network: 'mainnet', timeoutMs: 0 })).toThrow(InvalidInputError)
  })

  it('targets the mainnet endpoint', async () => {
    const fetch = vi.fn(async () => jsonResponse(sampleSpotMeta))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await client.spotMeta()
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe('https://api.hyperliquid.xyz/info')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ type: 'spotMeta' })
  })

  it('targets the testnet endpoint', async () => {
    const fetch = vi.fn(async () => jsonResponse(sampleSpotMeta))
    const client = createInfoClient({ network: 'testnet', fetch })
    await client.spotMeta()
    const [url] = fetch.mock.calls[0] ?? []
    expect(url).toBe('https://api.hyperliquid-testnet.xyz/info')
  })
})

describe('spotMeta', () => {
  it('returns the parsed payload', async () => {
    const fetch = vi.fn(async () => jsonResponse(sampleSpotMeta))
    const client = createInfoClient({ network: 'mainnet', fetch })
    const result = await client.spotMeta()
    expect(result).toEqual(sampleSpotMeta)
  })
})

describe('outcomeMeta', () => {
  it('posts an outcomeMeta body and returns the validated payload', async () => {
    const fetch = vi.fn(async () => jsonResponse(sampleOutcomeMeta))
    const client = createInfoClient({ network: 'mainnet', fetch })
    const result = await client.outcomeMeta()
    const [, init] = fetch.mock.calls[0] ?? []
    expect(JSON.parse(init?.body as string)).toEqual({ type: 'outcomeMeta' })
    expect(result).toEqual(sampleOutcomeMeta)
  })

  it('rejects missing outcomes', async () => {
    const fetch = vi.fn(async () => jsonResponse({ questions: [] }))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.outcomeMeta()).rejects.toThrow(/invalid outcomeMeta response/)
  })

  it('rejects malformed outcome sideSpecs', async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        outcomes: [{ ...sampleOutcomeMeta.outcomes[0], sideSpecs: [{ name: 'Yes' }] }],
      }),
    )
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.outcomeMeta()).rejects.toThrow(/invalid outcomeMeta outcome/)
  })

  it('rejects malformed questions', async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        ...sampleOutcomeMeta,
        questions: [{ ...sampleOutcomeMeta.questions?.[0], namedOutcomes: ['22'] }],
      }),
    )
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.outcomeMeta()).rejects.toThrow(/invalid outcomeMeta question/)
  })
})

describe('l2Book', () => {
  it('passes coin and nSigFigs in the body', async () => {
    const fetch = vi.fn(async () => jsonResponse(sampleL2Book))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await client.l2Book('@230', 5)
    const [, init] = fetch.mock.calls[0] ?? []
    expect(JSON.parse(init?.body as string)).toEqual({
      type: 'l2Book',
      coin: '@230',
      nSigFigs: 5,
    })
  })

  it('defaults nSigFigs to null', async () => {
    const fetch = vi.fn(async () => jsonResponse(sampleL2Book))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await client.l2Book('@230')
    const [, init] = fetch.mock.calls[0] ?? []
    expect(JSON.parse(init?.body as string)).toEqual({
      type: 'l2Book',
      coin: '@230',
      nSigFigs: null,
    })
  })

  it('returns the parsed book', async () => {
    const fetch = vi.fn(async () => jsonResponse(sampleL2Book))
    const client = createInfoClient({ network: 'mainnet', fetch })
    const result = await client.l2Book('@230')
    expect(result).toEqual(sampleL2Book)
  })

  it('rejects null l2Book responses', async () => {
    const fetch = vi.fn(async () => jsonResponse(null))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.l2Book('USDH/USDC')).rejects.toMatchObject({
      name: 'NetworkError',
      message: 'invalid l2Book response for USDH/USDC',
    })
  })

  it('rejects malformed l2Book responses', async () => {
    const fetch = vi.fn(async () => jsonResponse({ coin: '@230', time: 1, levels: [] }))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.l2Book('@230')).rejects.toThrow(/invalid l2Book response/)
  })
})

describe('allMids', () => {
  it('posts an allMids body and returns the parsed map', async () => {
    const fetch = vi.fn(async () => jsonResponse({ BTC: '60000', '@0': '1.0001' }))
    const client = createInfoClient({ network: 'mainnet', fetch })
    const result = await client.allMids()
    const [, init] = fetch.mock.calls[0] ?? []
    expect(JSON.parse(init?.body as string)).toEqual({ type: 'allMids' })
    expect(result).toEqual({ BTC: '60000', '@0': '1.0001' })
  })

  it('rejects malformed allMids responses', async () => {
    const fetch = vi.fn(async () => jsonResponse({ BTC: 60000 }))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.allMids()).rejects.toThrow(/invalid allMids response/)
  })
})

const sampleOpenOrder = {
  coin: 'USDH/USDC',
  side: 'B',
  limitPx: '1.0001',
  sz: '10',
  origSz: '10',
  oid: 91490942,
  timestamp: 1681247412573,
  reduceOnly: false,
  orderType: 'Limit',
  triggerCondition: 'N/A',
  triggerPx: '0.0',
  isPositionTpsl: false,
  isTrigger: false,
}

describe('frontendOpenOrders', () => {
  it('posts user and returns the parsed array', async () => {
    const fetch = vi.fn(async () => jsonResponse([sampleOpenOrder]))
    const client = createInfoClient({ network: 'mainnet', fetch })
    const result = await client.frontendOpenOrders('0x000000000000000000000000000000000000abcd')
    const [, init] = fetch.mock.calls[0] ?? []
    expect(JSON.parse(init?.body as string)).toEqual({
      type: 'frontendOpenOrders',
      user: '0x000000000000000000000000000000000000abcd',
    })
    expect(result).toEqual([sampleOpenOrder])
  })

  it('rejects an invalid entry shape', async () => {
    const fetch = vi.fn(async () => jsonResponse([{ ...sampleOpenOrder, side: 'X' }]))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(
      client.frontendOpenOrders('0x000000000000000000000000000000000000abcd'),
    ).rejects.toThrow(NetworkError)
  })
})

describe('orderStatus', () => {
  it('returns the parsed status detail', async () => {
    const orderDetail = {
      order: { ...sampleOpenOrder },
      status: 'open',
      statusTimestamp: 1724361546645,
    }
    const fetch = vi.fn(async () => jsonResponse({ status: 'order', order: orderDetail }))
    const client = createInfoClient({ network: 'mainnet', fetch })
    const result = await client.orderStatus('0x000000000000000000000000000000000000abcd', 91490942)
    const [, init] = fetch.mock.calls[0] ?? []
    expect(JSON.parse(init?.body as string)).toEqual({
      type: 'orderStatus',
      user: '0x000000000000000000000000000000000000abcd',
      oid: 91490942,
    })
    expect(result).toEqual({ status: 'order', order: orderDetail })
  })

  it('returns the unknownOid sentinel as-is', async () => {
    const fetch = vi.fn(async () => jsonResponse({ status: 'unknownOid' }))
    const client = createInfoClient({ network: 'mainnet', fetch })
    const result = await client.orderStatus('0x000000000000000000000000000000000000abcd', 999)
    expect(result).toEqual({ status: 'unknownOid' })
  })

  it('rejects a negative oid synchronously', () => {
    const fetch = vi.fn(async () => jsonResponse({ status: 'unknownOid' }))
    const client = createInfoClient({ network: 'mainnet', fetch })
    expect(() => client.orderStatus('0x000000000000000000000000000000000000abcd', -1)).toThrow(
      InvalidInputError,
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('error handling', () => {
  it('wraps non-2xx HTTP status in NetworkError', async () => {
    const fetch = vi.fn(async () => new Response('rate limited', { status: 429 }))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.spotMeta()).rejects.toMatchObject({
      name: 'NetworkError',
      status: 429,
    })
  })

  it('wraps fetch failure in NetworkError', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('connection refused')
    })
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.spotMeta()).rejects.toBeInstanceOf(NetworkError)
  })

  it('wraps invalid JSON in NetworkError', async () => {
    const fetch = vi.fn(
      async () =>
        new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }),
    )
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.spotMeta()).rejects.toBeInstanceOf(NetworkError)
  })

  it('surfaces 200 responses with an `error` field', async () => {
    const fetch = vi.fn(async () => jsonResponse({ error: 'Unknown coin' }))
    const client = createInfoClient({ network: 'mainnet', fetch })
    await expect(client.l2Book('NOPE/USDC')).rejects.toMatchObject({
      name: 'NetworkError',
      message: 'HL error: Unknown coin',
    })
  })

  it('reports timeouts distinctly from other transport failures', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })
    const client = createInfoClient({ network: 'mainnet', fetch, timeoutMs: 10 })
    await expect(client.spotMeta()).rejects.toThrow(/timed out after 10ms/)
  })
})

describe('input validation', () => {
  it('rejects nSigFigs outside 2..5', () => {
    const fetch = vi.fn(async () => jsonResponse(sampleL2Book))
    const client = createInfoClient({ network: 'mainnet', fetch })
    // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
    expect(() => client.l2Book('@230', 1 as any)).toThrow(InvalidInputError)
    // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
    expect(() => client.l2Book('@230', 6 as any)).toThrow(InvalidInputError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
