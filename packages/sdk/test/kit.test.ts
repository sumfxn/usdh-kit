import { describe, expect, it, vi } from 'vitest'

import {
  BridgeAndSwapError,
  InsufficientBalanceError,
  InvalidInputError,
  MissingEvmWalletError,
  NetworkError,
  NotImplementedError,
  type Signer,
  createUsdhKit,
  isBridgeAndSwapError,
} from '../src/index.js'
import type { L2Book, OutcomeMeta, SpotMeta } from '../src/transport/types.js'
import type { EvmWallet } from '../src/types/evm-wallet.js'

const stubSigner: Signer = {
  address: '0x0000000000000000000000000000000000000001',
  signTypedData: async () => `0x${'a'.repeat(64)}${'b'.repeat(64)}1c` as const,
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
      evmContract: {
        address: '0x6b9e773128f453f5c2c60935ee2de2cbc5390a24',
        evm_extra_wei_decimals: -2,
      },
    },
    {
      name: 'USDH',
      szDecimals: 8,
      weiDecimals: 8,
      index: 1,
      tokenId: '0xbbbb',
      isCanonical: true,
      evmContract: {
        address: '0x111111a1a0667d36bd57c0a9f569b98057111111',
        evm_extra_wei_decimals: -2,
      },
    },
  ],
}

const reverseSpotMeta: SpotMeta = {
  ...sampleSpotMeta,
  tokens: sampleSpotMeta.tokens.map((token) =>
    token.name === 'USDH' ? { ...token, szDecimals: 2 } : token,
  ),
}

const sampleL2Book: L2Book = {
  coin: 'USDH/USDC',
  time: 1735300000000,
  levels: [[{ px: '0.9998', sz: '10000', n: 1 }], [{ px: '1.0002', sz: '10000', n: 1 }]],
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
  questions: [],
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function backend(exchangeResponse: unknown): {
  fetch: typeof globalThis.fetch
  getExchangeBody: () => Record<string, unknown> | undefined
} {
  let exchangeBody: Record<string, unknown> | undefined
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    if (url.endsWith('/info')) {
      if (body.type === 'spotMeta') return jsonResponse(sampleSpotMeta)
      if (body.type === 'l2Book') return jsonResponse(sampleL2Book)
      throw new Error(`unexpected /info body: ${JSON.stringify(body)}`)
    }
    if (url.endsWith('/exchange')) {
      exchangeBody = body
      return jsonResponse(exchangeResponse)
    }
    throw new Error(`unexpected url: ${url}`)
  }) as unknown as typeof globalThis.fetch
  return { fetch, getExchangeBody: () => exchangeBody }
}

function reverseSwapBackend(exchangeResponse: unknown): {
  fetch: typeof globalThis.fetch
  getExchangeBody: () => Record<string, unknown> | undefined
} {
  let exchangeBody: Record<string, unknown> | undefined
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    if (url.endsWith('/info')) {
      if (body.type === 'spotMeta') return jsonResponse(reverseSpotMeta)
      if (body.type === 'l2Book') return jsonResponse(sampleL2Book)
      throw new Error(`unexpected /info body: ${JSON.stringify(body)}`)
    }
    if (url.endsWith('/exchange')) {
      exchangeBody = body
      return jsonResponse(exchangeResponse)
    }
    throw new Error(`unexpected url: ${url}`)
  }) as unknown as typeof globalThis.fetch
  return { fetch, getExchangeBody: () => exchangeBody }
}

function outcomeBackend(): {
  fetch: typeof globalThis.fetch
  getInfoBodies: () => Record<string, unknown>[]
} {
  const infoBodies: Record<string, unknown>[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    if (!url.endsWith('/info')) throw new Error(`unexpected url: ${url}`)
    infoBodies.push(body)
    if (body.type === 'outcomeMeta') return jsonResponse(sampleOutcomeMeta)
    if (body.type === 'l2Book') {
      return jsonResponse({
        coin: body.coin,
        time: 1778427457824,
        levels: [[{ px: '0.73331', sz: '136.0', n: 1 }], [{ px: '0.73332', sz: '222.0', n: 2 }]],
      })
    }
    if (body.type === 'allMids') {
      return jsonResponse({ '#200': '0.733315', '#201': '0.266685', BTC: '80657' })
    }
    throw new Error(`unexpected /info body: ${JSON.stringify(body)}`)
  }) as unknown as typeof globalThis.fetch
  return { fetch, getInfoBodies: () => infoBodies }
}

type HcBalanceFixture = string | { total: string; hold?: string }

function routingBackend(
  exchangeResponse: unknown,
  hcBalances: HcBalanceFixture[] = ['0'],
): {
  fetch: typeof globalThis.fetch
  getExchangeBody: () => Record<string, unknown> | undefined
  getInfoBodies: () => Record<string, unknown>[]
} {
  let exchangeBody: Record<string, unknown> | undefined
  const infoBodies: Record<string, unknown>[] = []
  let balanceIndex = 0
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    if (url.endsWith('/info')) {
      infoBodies.push(body)
      if (body.type === 'spotMeta') return jsonResponse(sampleSpotMeta)
      if (body.type === 'l2Book') return jsonResponse(sampleL2Book)
      if (body.type === 'spotClearinghouseState') {
        const fixture = hcBalances[Math.min(balanceIndex, hcBalances.length - 1)] ?? '0'
        balanceIndex += 1
        const total = typeof fixture === 'string' ? fixture : fixture.total
        const hold = typeof fixture === 'string' ? '0' : (fixture.hold ?? '0')
        return jsonResponse({
          balances: [{ coin: 'USDC', token: 0, total, hold, entryNtl: '0' }],
        })
      }
      throw new Error(`unexpected /info body: ${JSON.stringify(body)}`)
    }
    if (url.endsWith('/exchange')) {
      exchangeBody = body
      return jsonResponse(exchangeResponse)
    }
    throw new Error(`unexpected url: ${url}`)
  }) as unknown as typeof globalThis.fetch
  return { fetch, getExchangeBody: () => exchangeBody, getInfoBodies: () => infoBodies }
}

function stubEvmWallet(txHash = `0x${'c'.repeat(64)}`): EvmWallet & { calls: unknown[] } {
  const calls: unknown[] = []
  return {
    address: stubSigner.address,
    sendTransaction: async (req) => {
      calls.push(req)
      return txHash as `0x${string}`
    },
    calls,
  }
}

describe('outcome market reads', () => {
  it('lists and fetches experimental outcome markets', async () => {
    const { fetch } = outcomeBackend()
    const kit = createUsdhKit({ network: 'testnet', signer: stubSigner, fetch })

    await expect(kit.listOutcomeMarkets()).resolves.toMatchObject([
      { outcome: 20, sides: [{ coin: '#200' }, { coin: '#201' }] },
    ])
    await expect(kit.getOutcomeMarket({ outcome: 20 })).resolves.toMatchObject({
      outcome: 20,
      descriptionFields: { underlying: 'BTC' },
    })
  })

  it('reads outcome books and mids through the kit', async () => {
    const { fetch, getInfoBodies } = outcomeBackend()
    const kit = createUsdhKit({ network: 'testnet', signer: stubSigner, fetch })

    await expect(kit.getOutcomeBook({ outcome: 20, side: 0, nSigFigs: 5 })).resolves.toMatchObject({
      coin: '#200',
    })
    await expect(kit.getOutcomeMids()).resolves.toEqual({
      '#200': '0.733315',
      '#201': '0.266685',
    })

    expect(getInfoBodies()).toEqual([
      { type: 'l2Book', coin: '#200', nSigFigs: 5 },
      { type: 'allMids' },
    ])
  })
})

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
  it('validates the source stable', async () => {
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner })
    // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
    await expect(kit.swap({ from: 'DAI' as any, amount: 1n })).rejects.toThrow(InvalidInputError)
  })

  it('validates the amount', async () => {
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner })
    await expect(kit.swap({ from: 'USDC', amount: 0n })).rejects.toThrow(InvalidInputError)
  })

  it('rejects full sell slippage before fetching or signing', async () => {
    const fetch = vi.fn(async () => jsonResponse({})) as unknown as typeof globalThis.fetch
    const signTypedData = vi.fn(stubSigner.signTypedData)
    const kit = createUsdhKit({
      network: 'mainnet',
      signer: { ...stubSigner, signTypedData },
      fetch,
    })

    await expect(
      kit.swap({ from: 'USDH', to: 'USDC', amount: 11_000_000n, slippageBps: 10_000 }),
    ).rejects.toThrow(/less than 10000/)
    expect(fetch).not.toHaveBeenCalled()
    expect(signTypedData).not.toHaveBeenCalled()
  })

  it('throws NotImplementedError for USDT', async () => {
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner })
    await expect(kit.swap({ from: 'USDT', amount: 1_000_000n })).rejects.toThrow(
      NotImplementedError,
    )
  })

  it('builds the order action with a Hyperliquid-valid spot price and submits a signed IOC', async () => {
    // mid = 1.0; default slippage 20 bps -> internal limit 1.002,
    // then spot tick rules for szDecimals=8 truncate the wire price to 1.
    const filledResponse = {
      status: 'ok',
      response: {
        type: 'order',
        data: {
          statuses: [{ filled: { totalSz: '0.999800', avgPx: '1.0002', oid: 12345 } }],
        },
      },
    }
    const { fetch, getExchangeBody } = backend(filledResponse)
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    const result = await kit.swap({ from: 'USDC', amount: 11_000_000n })

    const body = getExchangeBody()
    expect(body).toBeDefined()
    expect(body?.action).toMatchObject({
      type: 'order',
      grouping: 'na',
      orders: [
        expect.objectContaining({
          a: 10000,
          b: true,
          p: '1',
          r: false,
          s: '11',
          t: { limit: { tif: 'Ioc' } },
        }),
      ],
    })
    expect(body?.signature).toMatchObject({ v: 28 })
    expect(typeof body?.nonce).toBe('number')
    expect(typeof body?.expiresAfter).toBe('number')
    expect(body?.expiresAfter as number).toBeGreaterThan(body?.nonce as number)

    expect(result.orderId).toBe('12345')
    expect(result.received).toBe(999_800n)
    expect(result.price).toBe(1_000_200_000_000_000_000n)
    expect(result.slippageBps).toBe(2)
    expect('txHash' in result).toBe(false)
  })

  it('sells USDH for USDC with a slippage-adjusted IOC order', async () => {
    const filledResponse = {
      status: 'ok',
      response: {
        type: 'order',
        data: {
          statuses: [{ filled: { totalSz: '11', avgPx: '1', oid: 54321 } }],
        },
      },
    }
    const { fetch, getExchangeBody } = reverseSwapBackend(filledResponse)
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    const result = await kit.swap({ from: 'USDH', to: 'USDC', amount: 11_000_000n })

    const body = getExchangeBody()
    expect(body?.action).toMatchObject({
      type: 'order',
      grouping: 'na',
      orders: [
        expect.objectContaining({
          a: 10000,
          b: false,
          p: '0.998',
          r: false,
          s: '11',
          t: { limit: { tif: 'Ioc' } },
        }),
      ],
    })
    expect(result.orderId).toBe('54321')
    expect(result.received).toBe(11_000_000n)
    expect(result.spent).toBe(11_000_000n)
    expect(result.price).toBe(1_000_000_000_000_000_000n)
  })

  it('still applies Hyperliquid spot tick rules to per-call slippage limits', async () => {
    const filledResponse = {
      status: 'ok',
      response: {
        type: 'order',
        data: {
          statuses: [{ filled: { totalSz: '0.99', avgPx: '1.001', oid: 1 } }],
        },
      },
    }
    const { fetch, getExchangeBody } = backend(filledResponse)
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await kit.swap({ from: 'USDC', amount: 11_000_000n, slippageBps: 100 })

    const body = getExchangeBody()
    const order = (body?.action as { orders: Array<{ p: string }> }).orders[0]
    // mid = 1.0, slippage 100 bps -> internal limit 1.01,
    // then szDecimals=8 allows zero fractional price digits.
    expect(order?.p).toBe('1')
  })

  it('emits a monotonic nonce across concurrent calls', async () => {
    const filledResponse = {
      status: 'ok',
      response: {
        type: 'order',
        data: { statuses: [{ filled: { totalSz: '0.999', avgPx: '1.001', oid: 1 } }] },
      },
    }
    const nonces: number[] = []
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const body = JSON.parse(init?.body as string) as { type?: string; nonce?: number }
      if (url.endsWith('/info')) {
        return jsonResponse(body.type === 'spotMeta' ? sampleSpotMeta : sampleL2Book)
      }
      if (typeof body.nonce === 'number') nonces.push(body.nonce)
      return jsonResponse(filledResponse)
    }) as unknown as typeof globalThis.fetch
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await Promise.all([
      kit.swap({ from: 'USDC', amount: 11_000_000n }),
      kit.swap({ from: 'USDC', amount: 11_000_000n }),
    ])

    expect(nonces.length).toBe(2)
    expect(nonces[1]).toBeGreaterThan(nonces[0] ?? 0)
  })

  it('throws NetworkError when /exchange returns status err', async () => {
    const { fetch } = backend({ status: 'err', response: 'Insufficient margin' })
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    await expect(kit.swap({ from: 'USDC', amount: 11_000_000n })).rejects.toThrow(NetworkError)
  })

  it('throws NetworkError when the order returns an error status', async () => {
    const { fetch } = backend({
      status: 'ok',
      response: { type: 'order', data: { statuses: [{ error: 'Order missed' }] } },
    })
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    await expect(kit.swap({ from: 'USDC', amount: 11_000_000n })).rejects.toThrow(NetworkError)
  })

  it('reports the realised slippage on the result without throwing', async () => {
    // mid = 1.0; realised fill 1.0005 -> 5 bps. Within default tolerance.
    const { fetch } = backend({
      status: 'ok',
      response: {
        type: 'order',
        data: { statuses: [{ filled: { totalSz: '0.999', avgPx: '1.0005', oid: 9 } }] },
      },
    })
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    const result = await kit.swap({ from: 'USDC', amount: 11_000_000n })
    expect(result.slippageBps).toBe(5)
  })

  it('rejects swaps below Hyperliquid minimum order value before signing', async () => {
    const signTypedData = vi.fn(stubSigner.signTypedData)
    const kit = createUsdhKit({
      network: 'mainnet',
      signer: { ...stubSigner, signTypedData },
    })

    await expect(kit.swap({ from: 'USDC', amount: 10_000_000n })).rejects.toThrow(InvalidInputError)
    expect(signTypedData).not.toHaveBeenCalled()
  })
})

describe('getQuote', () => {
  it('returns USDH estimate from the orderbook mid-price', async () => {
    const { fetch } = backend({})
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    const quote = await kit.getQuote({ from: 'USDC', amount: 1_000_000n })
    expect(quote.from).toBe('USDC')
    expect(quote.to).toBe('USDH')
    expect(quote.pair).toBe('USDH/USDC')
    expect(quote.midPrice).toBe(1_000_000_000_000_000_000n)
    expect(quote.estimatedReceived).toBe(1_000_000n)
    expect(quote.validUntil).toBeGreaterThan(Date.now())
  })

  it('returns USDC estimate for USDH input', async () => {
    const { fetch } = backend({})
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    const quote = await kit.getQuote({ from: 'USDH', to: 'USDC', amount: 2_000_000n })
    expect(quote.from).toBe('USDH')
    expect(quote.to).toBe('USDC')
    expect(quote.estimatedReceived).toBe(2_000_000n)
  })

  it('caches the pair resolution across quote calls', async () => {
    const { fetch } = backend({})
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
    const fetch = vi.fn(async () => jsonResponse({})) as unknown as typeof globalThis.fetch
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    await expect(kit.getQuote({ from: 'USDC', amount: 0n })).rejects.toThrow(InvalidInputError)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('getRoute', () => {
  it('routes directly from HyperCore when HC balance covers amount plus buffers', async () => {
    const { fetch } = routingBackend({}, ['20'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch, slippageBps: 30 })

    const route = await kit.getRoute({ from: 'USDC', amount: 11_000_000n })

    expect(route.sourceChain).toBe('hypercore')
    expect(route.requiresBridge).toBe(false)
    expect(route.canSwap).toBe(true)
    expect(route.hypercoreBalance).toBe(2_000_000_000n)
    expect(route.hypercoreTotal).toBe(2_000_000_000n)
    expect(route.hypercoreHold).toBe(0n)
  })

  it('routes USDH -> USDC as a HyperCore-only swap', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const body = JSON.parse(init?.body as string) as Record<string, unknown>
      if (!url.endsWith('/info')) throw new Error(`unexpected url: ${url}`)
      if (body.type === 'spotMeta') return jsonResponse(reverseSpotMeta)
      if (body.type === 'l2Book') return jsonResponse(sampleL2Book)
      if (body.type === 'spotClearinghouseState') {
        return jsonResponse({
          balances: [{ coin: 'USDH', token: 1, total: '20', hold: '0', entryNtl: '0' }],
        })
      }
      throw new Error(`unexpected /info body: ${JSON.stringify(body)}`)
    }) as unknown as typeof globalThis.fetch
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    const route = await kit.getRoute({ from: 'USDH', to: 'USDC', amount: 11_000_000n })

    expect(route.from).toBe('USDH')
    expect(route.to).toBe('USDC')
    expect(route.sourceChain).toBe('hypercore')
    expect(route.requiresBridge).toBe(false)
    expect(route.canSwap).toBe(true)
    expect(route.hypercoreBalance).toBe(2_000_000_000n)
    expect(route.requiredHypercoreBalance).toBe(1_100_000_000n)
  })

  it('rejects HyperEVM source selection for USDH -> USDC', async () => {
    const { fetch } = routingBackend({}, ['20'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await expect(
      kit.getRoute({ from: 'USDH', to: 'USDC', amount: 11_000_000n, sourceChain: 'hyperevm' }),
    ).rejects.toThrow(/only supports sourceChain=hypercore/)
  })

  it('rejects full sell slippage during route preflight', async () => {
    const fetch = vi.fn(async () => jsonResponse({})) as unknown as typeof globalThis.fetch
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await expect(
      kit.getRoute({ from: 'USDH', to: 'USDC', amount: 11_000_000n, slippageBps: 10_000 }),
    ).rejects.toThrow(/less than 10000/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('routes through HyperEVM when HC total covers but open-order hold leaves it short', async () => {
    const { fetch } = routingBackend({}, [{ total: '20', hold: '15' }])
    const kit = createUsdhKit({
      network: 'mainnet',
      signer: stubSigner,
      evmWallet: stubEvmWallet(),
      fetch,
    })

    const route = await kit.getRoute({ from: 'USDC', amount: 11_000_000n })

    expect(route.sourceChain).toBe('hyperevm')
    expect(route.requiresBridge).toBe(true)
    expect(route.hypercoreBalance).toBe(500_000_000n)
    expect(route.hypercoreTotal).toBe(2_000_000_000n)
    expect(route.hypercoreHold).toBe(1_500_000_000n)
  })

  it("returns the user's HyperCore balance net of held funds", async () => {
    const { fetch } = routingBackend({}, [{ total: '2', hold: '0.75' }])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    const balance = await kit.getHypercoreBalance({ asset: 'USDC' })

    expect(balance).toEqual({
      asset: 'USDC',
      tokenIndex: 0,
      decimals: 8,
      total: 200_000_000n,
      hold: 75_000_000n,
      available: 125_000_000n,
    })
  })

  it('queries HyperCore balances for accountAddress when signer is an agent', async () => {
    const accountAddress = '0x00000000000000000000000000000000000000aa'
    const { fetch, getInfoBodies } = routingBackend({}, ['2'])
    const kit = createUsdhKit({
      network: 'mainnet',
      signer: stubSigner,
      accountAddress,
      fetch,
    })

    await kit.getHypercoreBalance({ asset: 'USDC' })

    const stateBody = getInfoBodies().find((body) => body.type === 'spotClearinghouseState')
    expect(stateBody?.user).toBe(accountAddress)
  })

  it('validates sourceChain at runtime', async () => {
    const { fetch } = routingBackend({}, ['2'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await expect(
      kit.getRoute({
        from: 'USDC',
        amount: 1_000_000n,
        // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
        sourceChain: 'core' as any,
      }),
    ).rejects.toThrow(InvalidInputError)
  })

  it('routes through HyperEVM when HyperCore balance is short and an EVM wallet is configured', async () => {
    const { fetch } = routingBackend({}, ['0'])
    const kit = createUsdhKit({
      network: 'mainnet',
      signer: stubSigner,
      evmWallet: stubEvmWallet(),
      fetch,
    })

    const route = await kit.getRoute({ from: 'USDC', amount: 11_000_000n })

    expect(route.sourceChain).toBe('hyperevm')
    expect(route.requiresBridge).toBe(true)
    expect(route.canSwap).toBe(true)
    expect(route.blockReason).toBeUndefined()
  })

  it('surfaces a missing wallet when the selected route requires a bridge', async () => {
    const { fetch } = routingBackend({}, ['0'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    const route = await kit.preflightSwap({ from: 'USDC', amount: 11_000_000n })

    expect(route.requiresBridge).toBe(true)
    expect(route.canSwap).toBe(false)
    expect(route.blockReason).toBe('missing_evm_wallet')
  })

  it('surfaces insufficient HC balance when HyperCore is forced', async () => {
    const { fetch } = routingBackend({}, ['0'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    const route = await kit.getRoute({
      from: 'USDC',
      amount: 11_000_000n,
      sourceChain: 'hypercore',
    })

    expect(route.sourceChain).toBe('hypercore')
    expect(route.requiresBridge).toBe(false)
    expect(route.canSwap).toBe(false)
    expect(route.blockReason).toBe('insufficient_hypercore_balance')
  })

  it('surfaces the Hyperliquid minimum order value before balance blockers', async () => {
    const { fetch } = routingBackend({}, ['20'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    const route = await kit.getRoute({ from: 'USDC', amount: 10_000_000n })

    expect(route.canSwap).toBe(false)
    expect(route.blockReason).toBe('below_min_order_value')
  })
})

describe('bridgeAndSwap', () => {
  const filledResponse = {
    status: 'ok',
    response: {
      type: 'order',
      data: { statuses: [{ filled: { totalSz: '0.999800', avgPx: '1.0002', oid: 12345 } }] },
    },
  }

  it('bridges from HyperEVM before swapping when the route requires a bridge', async () => {
    const { fetch } = routingBackend(filledResponse, ['0', '0', '11'])
    const evmWallet = stubEvmWallet(`0x${'d'.repeat(64)}`)
    const progress = vi.fn()
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, evmWallet, fetch })

    const result = await kit.bridgeAndSwap({
      from: 'USDC',
      amount: 11_000_000n,
      waitForCreditTimeoutMs: 3_000,
      onProgress: progress,
    })

    expect(evmWallet.calls).toHaveLength(2)
    expect(evmWallet.calls[0]).toMatchObject({ to: '0xb88339cb7199b77e23db6e890353e22632ba630f' })
    expect(evmWallet.calls[1]).toMatchObject({ to: '0x6b9e773128f453f5c2c60935ee2de2cbc5390a24' })
    expect(result.bridge?.txHash).toBe(`0x${'d'.repeat(64)}`)
    expect(result.swap.orderId).toBe('12345')
    expect(progress.mock.calls.map(([event]) => event.phase)).toEqual([
      'route',
      'bridging',
      'swapping',
      'done',
    ])
  })

  it('uses accountAddress for bridge ownership while the agent signs the order', async () => {
    const accountAddress = '0x00000000000000000000000000000000000000aa'
    const { fetch, getExchangeBody, getInfoBodies } = routingBackend(filledResponse, [
      '0',
      '0',
      '11',
    ])
    const evmWallet = stubEvmWallet(`0x${'d'.repeat(64)}`)
    const signTypedData = vi.fn(stubSigner.signTypedData)
    const signer: Signer = { ...stubSigner, signTypedData }
    const kit = createUsdhKit({ network: 'mainnet', signer, accountAddress, evmWallet, fetch })

    await kit.bridgeAndSwap({
      from: 'USDC',
      amount: 11_000_000n,
      waitForCreditTimeoutMs: 3_000,
    })

    expect(evmWallet.calls[0]).toMatchObject({ to: '0xb88339cb7199b77e23db6e890353e22632ba630f' })
    expect(evmWallet.calls[1]).toMatchObject({ to: '0x6b9e773128f453f5c2c60935ee2de2cbc5390a24' })
    expect(signTypedData).toHaveBeenCalledOnce()
    expect(getExchangeBody()?.signature).toMatchObject({ v: 28 })
    const stateUsers = getInfoBodies()
      .filter((body) => body.type === 'spotClearinghouseState')
      .map((body) => body.user)
    expect(stateUsers).toContain(accountAddress)
    expect(stateUsers).not.toContain(stubSigner.address)
  })

  it('skips the bridge when HyperCore already covers the route', async () => {
    const { fetch } = routingBackend(filledResponse, ['20'])
    const evmWallet = stubEvmWallet()
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, evmWallet, fetch })

    const result = await kit.bridgeAndSwap({ from: 'USDC', amount: 11_000_000n })

    expect(evmWallet.calls).toHaveLength(0)
    expect(result.bridge).toBeUndefined()
    expect(result.route.sourceChain).toBe('hypercore')
    expect(result.swap.orderId).toBe('12345')
  })

  it('works when bridgeAndSwap is destructured from the kit object', async () => {
    const { fetch } = routingBackend(filledResponse, ['20'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    const { bridgeAndSwap } = kit

    const result = await bridgeAndSwap({ from: 'USDC', amount: 11_000_000n })

    expect(result.route.sourceChain).toBe('hypercore')
    expect(result.swap.orderId).toBe('12345')
  })

  it('throws MissingEvmWalletError when auto routing needs a bridge but no EVM wallet exists', async () => {
    const { fetch } = routingBackend(filledResponse, ['0'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await expect(kit.bridgeAndSwap({ from: 'USDC', amount: 11_000_000n })).rejects.toThrow(
      MissingEvmWalletError,
    )
  })

  it('throws InsufficientBalanceError when HyperCore is forced without enough balance', async () => {
    const { fetch } = routingBackend(filledResponse, ['0'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await expect(
      kit.bridgeAndSwap({ from: 'USDC', amount: 11_000_000n, sourceChain: 'hypercore' }),
    ).rejects.toThrow(InsufficientBalanceError)
  })

  it('detects BridgeAndSwapError across instance and structural shapes', () => {
    const real = new BridgeAndSwapError('bridging', new Error('wallet offline'))
    const structural = {
      name: 'BridgeAndSwapError',
      phase: 'swapping',
      cause: new NetworkError('exchange error: Insufficient margin'),
    }

    expect(isBridgeAndSwapError(real)).toBe(true)
    expect(isBridgeAndSwapError(structural)).toBe(true)
    expect(isBridgeAndSwapError({ name: 'BridgeAndSwapError', phase: 'done', cause: real })).toBe(
      false,
    )
    expect(isBridgeAndSwapError(new Error('plain'))).toBe(false)
  })

  it('wraps route failures with lifecycle context', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('info offline')
    }) as unknown as typeof globalThis.fetch
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    let thrown: unknown
    try {
      await kit.bridgeAndSwap({ from: 'USDC', amount: 11_000_000n })
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(BridgeAndSwapError)
    const err = thrown as BridgeAndSwapError
    expect(err.phase).toBe('route')
    expect(err.route).toBeUndefined()
    expect(err.bridge).toBeUndefined()
    expect(err.cause).toBeInstanceOf(NetworkError)
  })

  it('wraps bridge failures with lifecycle context', async () => {
    const { fetch } = routingBackend(filledResponse, ['0'])
    const evmWallet: EvmWallet = {
      address: stubSigner.address,
      sendTransaction: async () => {
        throw new Error('wallet offline')
      },
    }
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, evmWallet, fetch })

    let thrown: unknown
    try {
      await kit.bridgeAndSwap({ from: 'USDC', amount: 11_000_000n })
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(BridgeAndSwapError)
    const err = thrown as BridgeAndSwapError
    expect(err.phase).toBe('bridging')
    expect(err.route?.sourceChain).toBe('hyperevm')
    expect(err.bridge).toBeUndefined()
    expect(err.cause).toBeInstanceOf(Error)
    expect(err.message).toContain('wallet offline')
  })

  it('wraps swap failures with lifecycle context', async () => {
    const { fetch } = routingBackend({ status: 'err', response: 'Insufficient margin' }, ['20'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    let thrown: unknown
    try {
      await kit.bridgeAndSwap({ from: 'USDC', amount: 11_000_000n })
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(BridgeAndSwapError)
    const err = thrown as BridgeAndSwapError
    expect(err.phase).toBe('swapping')
    expect(err.route?.sourceChain).toBe('hypercore')
    expect(err.bridge).toBeUndefined()
    expect(err.cause).toBeInstanceOf(NetworkError)
  })
})
