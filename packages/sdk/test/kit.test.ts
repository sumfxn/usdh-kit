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
import type { L2Book, SpotMeta } from '../src/transport/types.js'
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

function backend(exchangeResponse: unknown): {
  fetch: typeof fetch
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
  }) as unknown as typeof fetch
  return { fetch, getExchangeBody: () => exchangeBody }
}

type HcBalanceFixture = string | { total: string; hold?: string }

function routingBackend(
  exchangeResponse: unknown,
  hcBalances: HcBalanceFixture[] = ['0'],
): {
  fetch: typeof fetch
  getExchangeBody: () => Record<string, unknown> | undefined
} {
  let exchangeBody: Record<string, unknown> | undefined
  let balanceIndex = 0
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    if (url.endsWith('/info')) {
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
  }) as unknown as typeof fetch
  return { fetch, getExchangeBody: () => exchangeBody }
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

  it('throws NotImplementedError for USDT', async () => {
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner })
    await expect(kit.swap({ from: 'USDT', amount: 1_000_000n })).rejects.toThrow(
      NotImplementedError,
    )
  })

  it('builds the order action with aggressive limit and submits a signed IOC', async () => {
    // mid = 1.0; default slippage 20 bps -> limit 1.002
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

    const result = await kit.swap({ from: 'USDC', amount: 1_000_000n })

    const body = getExchangeBody()
    expect(body).toBeDefined()
    expect(body?.action).toMatchObject({
      type: 'order',
      grouping: 'na',
      orders: [
        expect.objectContaining({
          a: 10000,
          b: true,
          p: '1.002',
          r: false,
          t: { limit: { tif: 'Ioc' } },
        }),
      ],
    })
    expect(body?.signature).toMatchObject({ v: 28 })
    expect(typeof body?.nonce).toBe('number')

    expect(result.orderId).toBe('12345')
    expect(result.received).toBe(999_800n)
    expect(result.price).toBe(1_000_200_000_000_000_000n)
    expect(result.slippageBps).toBe(2)
    expect('txHash' in result).toBe(false)
  })

  it('respects per-call slippageBps in the limit price', async () => {
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

    await kit.swap({ from: 'USDC', amount: 1_000_000n, slippageBps: 100 })

    const body = getExchangeBody()
    const order = (body?.action as { orders: Array<{ p: string }> }).orders[0]
    // mid = 1.0, slippage 100 bps -> limit = 1.01
    expect(order?.p).toBe('1.01')
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
    }) as unknown as typeof fetch
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await Promise.all([
      kit.swap({ from: 'USDC', amount: 1_000_000n }),
      kit.swap({ from: 'USDC', amount: 1_000_000n }),
    ])

    expect(nonces.length).toBe(2)
    expect(nonces[1]).toBeGreaterThan(nonces[0] ?? 0)
  })

  it('throws NetworkError when /exchange returns status err', async () => {
    const { fetch } = backend({ status: 'err', response: 'Insufficient margin' })
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    await expect(kit.swap({ from: 'USDC', amount: 1_000_000n })).rejects.toThrow(NetworkError)
  })

  it('throws NetworkError when the order returns an error status', async () => {
    const { fetch } = backend({
      status: 'ok',
      response: { type: 'order', data: { statuses: [{ error: 'Order missed' }] } },
    })
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    await expect(kit.swap({ from: 'USDC', amount: 1_000_000n })).rejects.toThrow(NetworkError)
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
    const result = await kit.swap({ from: 'USDC', amount: 1_000_000n })
    expect(result.slippageBps).toBe(5)
  })
})

describe('getQuote', () => {
  it('returns USDH estimate from the orderbook mid-price', async () => {
    const { fetch } = backend({})
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    const quote = await kit.getQuote({ from: 'USDC', amount: 1_000_000n })
    expect(quote.pair).toBe('USDH/USDC')
    expect(quote.midPrice).toBe(1_000_000_000_000_000_000n)
    expect(quote.estimatedReceived).toBe(1_000_000n)
    expect(quote.validUntil).toBeGreaterThan(Date.now())
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
    const fetch = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    await expect(kit.getQuote({ from: 'USDC', amount: 0n })).rejects.toThrow(InvalidInputError)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('getRoute', () => {
  it('routes directly from HyperCore when HC balance covers amount plus buffers', async () => {
    const { fetch } = routingBackend({}, ['2'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch, slippageBps: 30 })

    const route = await kit.getRoute({ from: 'USDC', amount: 1_000_000n })

    expect(route.sourceChain).toBe('hypercore')
    expect(route.requiresBridge).toBe(false)
    expect(route.canSwap).toBe(true)
    expect(route.hypercoreBalance).toBe(200_000_000n)
    expect(route.hypercoreTotal).toBe(200_000_000n)
    expect(route.hypercoreHold).toBe(0n)
  })

  it('routes through HyperEVM when HC total covers but open-order hold leaves it short', async () => {
    const { fetch } = routingBackend({}, [{ total: '2', hold: '1.5' }])
    const kit = createUsdhKit({
      network: 'mainnet',
      signer: stubSigner,
      evmWallet: stubEvmWallet(),
      fetch,
    })

    const route = await kit.getRoute({ from: 'USDC', amount: 1_000_000n })

    expect(route.sourceChain).toBe('hyperevm')
    expect(route.requiresBridge).toBe(true)
    expect(route.hypercoreBalance).toBe(50_000_000n)
    expect(route.hypercoreTotal).toBe(200_000_000n)
    expect(route.hypercoreHold).toBe(150_000_000n)
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

    const route = await kit.getRoute({ from: 'USDC', amount: 1_000_000n })

    expect(route.sourceChain).toBe('hyperevm')
    expect(route.requiresBridge).toBe(true)
    expect(route.canSwap).toBe(true)
    expect(route.blockReason).toBeUndefined()
  })

  it('surfaces a missing wallet when the selected route requires a bridge', async () => {
    const { fetch } = routingBackend({}, ['0'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    const route = await kit.preflightSwap({ from: 'USDC', amount: 1_000_000n })

    expect(route.requiresBridge).toBe(true)
    expect(route.canSwap).toBe(false)
    expect(route.blockReason).toBe('missing_evm_wallet')
  })

  it('surfaces insufficient HC balance when HyperCore is forced', async () => {
    const { fetch } = routingBackend({}, ['0'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    const route = await kit.getRoute({
      from: 'USDC',
      amount: 1_000_000n,
      sourceChain: 'hypercore',
    })

    expect(route.sourceChain).toBe('hypercore')
    expect(route.requiresBridge).toBe(false)
    expect(route.canSwap).toBe(false)
    expect(route.blockReason).toBe('insufficient_hypercore_balance')
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
    const { fetch } = routingBackend(filledResponse, ['0', '0', '1'])
    const evmWallet = stubEvmWallet(`0x${'d'.repeat(64)}`)
    const progress = vi.fn()
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, evmWallet, fetch })

    const result = await kit.bridgeAndSwap({
      from: 'USDC',
      amount: 1_000_000n,
      waitForCreditTimeoutMs: 3_000,
      onProgress: progress,
    })

    expect(evmWallet.calls).toHaveLength(1)
    expect(result.bridge?.txHash).toBe(`0x${'d'.repeat(64)}`)
    expect(result.swap.orderId).toBe('12345')
    expect(progress.mock.calls.map(([event]) => event.phase)).toEqual([
      'route',
      'bridging',
      'swapping',
      'done',
    ])
  })

  it('skips the bridge when HyperCore already covers the route', async () => {
    const { fetch } = routingBackend(filledResponse, ['2'])
    const evmWallet = stubEvmWallet()
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, evmWallet, fetch })

    const result = await kit.bridgeAndSwap({ from: 'USDC', amount: 1_000_000n })

    expect(evmWallet.calls).toHaveLength(0)
    expect(result.bridge).toBeUndefined()
    expect(result.route.sourceChain).toBe('hypercore')
    expect(result.swap.orderId).toBe('12345')
  })

  it('works when bridgeAndSwap is destructured from the kit object', async () => {
    const { fetch } = routingBackend(filledResponse, ['2'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })
    const { bridgeAndSwap } = kit

    const result = await bridgeAndSwap({ from: 'USDC', amount: 1_000_000n })

    expect(result.route.sourceChain).toBe('hypercore')
    expect(result.swap.orderId).toBe('12345')
  })

  it('throws MissingEvmWalletError when auto routing needs a bridge but no EVM wallet exists', async () => {
    const { fetch } = routingBackend(filledResponse, ['0'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await expect(kit.bridgeAndSwap({ from: 'USDC', amount: 1_000_000n })).rejects.toThrow(
      MissingEvmWalletError,
    )
  })

  it('throws InsufficientBalanceError when HyperCore is forced without enough balance', async () => {
    const { fetch } = routingBackend(filledResponse, ['0'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    await expect(
      kit.bridgeAndSwap({ from: 'USDC', amount: 1_000_000n, sourceChain: 'hypercore' }),
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
      await kit.bridgeAndSwap({ from: 'USDC', amount: 1_000_000n })
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
      await kit.bridgeAndSwap({ from: 'USDC', amount: 1_000_000n })
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
    const { fetch } = routingBackend({ status: 'err', response: 'Insufficient margin' }, ['2'])
    const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner, fetch })

    let thrown: unknown
    try {
      await kit.bridgeAndSwap({ from: 'USDC', amount: 1_000_000n })
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
