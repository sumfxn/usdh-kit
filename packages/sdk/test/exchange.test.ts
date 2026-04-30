import { describe, expect, it, vi } from 'vitest'

import { InvalidInputError, NetworkError } from '../src/errors.js'
import type { L1Signature } from '../src/signing.js'
import {
  type ExchangeResponse,
  type OrderResponse,
  createExchangeClient,
  isOrderResponse,
} from '../src/transport/exchange.js'

const sig: L1Signature = {
  r: '0xc0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0',
  s: '0xb0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0',
  v: 28,
}

const action = {
  type: 'order',
  orders: [{ a: 0, b: true, p: '1.0001', s: '100', r: false, t: { limit: { tif: 'Ioc' } } }],
  grouping: 'na',
}

const okFilled: ExchangeResponse = {
  status: 'ok',
  response: {
    type: 'order',
    data: {
      statuses: [{ filled: { totalSz: '100', avgPx: '1.0001', oid: 12345 } }],
    },
  } satisfies OrderResponse,
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

describe('createExchangeClient', () => {
  it('rejects an invalid network synchronously', () => {
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
      createExchangeClient({ network: 'devnet' as any }),
    ).toThrow(InvalidInputError)
  })

  it('rejects non-positive timeouts synchronously', () => {
    expect(() => createExchangeClient({ network: 'mainnet', timeoutMs: 0 })).toThrow(
      InvalidInputError,
    )
  })

  it('targets the mainnet endpoint', async () => {
    const fetch = vi.fn(async () => jsonResponse(okFilled))
    const client = createExchangeClient({ network: 'mainnet', fetch })
    await client.submit({ action, signature: sig, nonce: 1n })
    const [url] = fetch.mock.calls[0] ?? []
    expect(url).toBe('https://api.hyperliquid.xyz/exchange')
  })

  it('targets the testnet endpoint', async () => {
    const fetch = vi.fn(async () => jsonResponse(okFilled))
    const client = createExchangeClient({ network: 'testnet', fetch })
    await client.submit({ action, signature: sig, nonce: 1n })
    const [url] = fetch.mock.calls[0] ?? []
    expect(url).toBe('https://api.hyperliquid-testnet.xyz/exchange')
  })

  it('encodes action, nonce (as number), and signature in the body', async () => {
    const fetch = vi.fn(async () => jsonResponse(okFilled))
    const client = createExchangeClient({ network: 'mainnet', fetch })
    await client.submit({ action, signature: sig, nonce: 1735300000000n })
    const init = fetch.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    expect(body).toEqual({
      action,
      nonce: 1735300000000,
      signature: sig,
    })
  })

  it('includes vaultAddress when provided', async () => {
    const fetch = vi.fn(async () => jsonResponse(okFilled))
    const client = createExchangeClient({ network: 'mainnet', fetch })
    const vault = '0x000000000000000000000000000000000000abcd'
    await client.submit({ action, signature: sig, nonce: 1n, vaultAddress: vault })
    const init = fetch.mock.calls[0]?.[1]
    const body = JSON.parse(init?.body as string) as { vaultAddress?: string }
    expect(body.vaultAddress).toBe(vault)
  })

  it('omits vaultAddress when absent', async () => {
    const fetch = vi.fn(async () => jsonResponse(okFilled))
    const client = createExchangeClient({ network: 'mainnet', fetch })
    await client.submit({ action, signature: sig, nonce: 1n })
    const init = fetch.mock.calls[0]?.[1]
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    expect('vaultAddress' in body).toBe(false)
  })
})

describe('response handling', () => {
  it('returns ok responses as-is', async () => {
    const fetch = vi.fn(async () => jsonResponse(okFilled))
    const client = createExchangeClient({ network: 'mainnet', fetch })
    expect(await client.submit({ action, signature: sig, nonce: 1n })).toEqual(okFilled)
  })

  it('returns err responses as-is', async () => {
    const errResp: ExchangeResponse = { status: 'err', response: 'Insufficient margin' }
    const fetch = vi.fn(async () => jsonResponse(errResp))
    const client = createExchangeClient({ network: 'mainnet', fetch })
    expect(await client.submit({ action, signature: sig, nonce: 1n })).toEqual(errResp)
  })

  it('wraps non-2xx HTTP status in NetworkError', async () => {
    const fetch = vi.fn(async () => new Response('rate limited', { status: 429 }))
    const client = createExchangeClient({ network: 'mainnet', fetch })
    await expect(client.submit({ action, signature: sig, nonce: 1n })).rejects.toMatchObject({
      name: 'NetworkError',
      status: 429,
    })
  })

  it('throws on unexpected top-level shape', async () => {
    const fetch = vi.fn(async () => jsonResponse({ foo: 'bar' }))
    const client = createExchangeClient({ network: 'mainnet', fetch })
    await expect(client.submit({ action, signature: sig, nonce: 1n })).rejects.toBeInstanceOf(
      NetworkError,
    )
  })

  it('throws on err with non-string response', async () => {
    const fetch = vi.fn(async () => jsonResponse({ status: 'err', response: 123 }))
    const client = createExchangeClient({ network: 'mainnet', fetch })
    await expect(client.submit({ action, signature: sig, nonce: 1n })).rejects.toBeInstanceOf(
      NetworkError,
    )
  })

  it('reports timeouts distinctly', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })
    const client = createExchangeClient({ network: 'mainnet', fetch, timeoutMs: 10 })
    await expect(client.submit({ action, signature: sig, nonce: 1n })).rejects.toThrow(
      /timed out after 10ms/,
    )
  })
})

describe('isOrderResponse', () => {
  it('matches a valid order response', () => {
    expect(
      isOrderResponse({
        type: 'order',
        data: { statuses: [{ filled: { totalSz: '1', avgPx: '1', oid: 1 } }] },
      }),
    ).toBe(true)
  })

  it('rejects non-order response', () => {
    expect(isOrderResponse({ type: 'cancel', data: { statuses: [] } })).toBe(false)
  })

  it('rejects null and primitives', () => {
    expect(isOrderResponse(null)).toBe(false)
    expect(isOrderResponse(undefined)).toBe(false)
    expect(isOrderResponse('order')).toBe(false)
  })

  it('rejects shape without statuses array', () => {
    expect(isOrderResponse({ type: 'order', data: {} })).toBe(false)
    expect(isOrderResponse({ type: 'order', data: { statuses: 'nope' } })).toBe(false)
  })
})
