import { describe, expect, it, vi } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { createOrders } from '../src/orders.js'
import type { ExchangeClient } from '../src/transport/exchange.js'
import type { InfoClient } from '../src/transport/info.js'
import type { L2Book, SpotMeta } from '../src/transport/types.js'
import type { Address } from '../src/types/hex.js'
import type { Signer } from '../src/types/signer.js'

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

const sampleBook: L2Book = {
  coin: 'HYPE/USDH',
  time: 1735300000000,
  levels: [[{ px: '40.5', sz: '100', n: 1 }], [{ px: '40.6', sz: '100', n: 1 }]],
}

const ACCOUNT: Address = '0x000000000000000000000000000000000000abcd'

function stubInfo(overrides: Partial<InfoClient> = {}): InfoClient {
  return {
    spotMeta: vi.fn(async () => meta),
    outcomeMeta: vi.fn(),
    l2Book: vi.fn(async () => sampleBook),
    spotClearinghouseState: vi.fn(),
    allMids: vi.fn(),
    frontendOpenOrders: vi.fn(async () => []),
    orderStatus: vi.fn(),
    ...overrides,
  }
}

function stubSigner(): Signer {
  return {
    address: ACCOUNT,
    signTypedData: vi.fn(async () => `0x${'11'.repeat(64)}1c` as `0x${string}`),
    signMessage: vi.fn(),
  }
}

function nonceFactory() {
  let n = 1_700_000_000_000n
  return () => {
    n += 1n
    return n
  }
}

function exchangeOk(response: unknown): ExchangeClient {
  return { submit: vi.fn(async () => ({ status: 'ok', response })) }
}

function exchangeErr(message: string): ExchangeClient {
  return { submit: vi.fn(async () => ({ status: 'err', response: message })) }
}

describe('placeOrder', () => {
  it('places a limit order on a USDH-base pair with the correct asset index', async () => {
    const exchange = exchangeOk({
      type: 'order',
      data: { statuses: [{ resting: { oid: 7777 } }] },
    })
    const orders = createOrders({
      info: stubInfo(),
      exchange,
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })

    const result = await orders.placeOrder({
      pair: 'USDH/USDC',
      side: 'buy',
      size: '10',
      price: '1',
    })

    expect(result).toEqual({ oid: 7777, status: 'resting', filledSize: '', avgPrice: '' })
    const [submitArgs] = (exchange.submit as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(submitArgs?.action).toMatchObject({
      type: 'order',
      grouping: 'na',
      orders: [
        {
          a: 10_000,
          b: true,
          p: '1',
          s: '10',
          r: false,
          t: { limit: { tif: 'Gtc' } },
        },
      ],
    })
  })

  it('places a market sell on a USDH-quote pair using slippage-adjusted limit', async () => {
    const exchange = exchangeOk({
      type: 'order',
      data: { statuses: [{ filled: { totalSz: '5', avgPx: '40.5', oid: 8888 } }] },
    })
    const orders = createOrders({
      info: stubInfo(),
      exchange,
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })

    const result = await orders.placeOrder({
      pair: 'HYPE/USDH',
      side: 'sell',
      size: '5',
    })

    expect(result).toEqual({ oid: 8888, status: 'filled', filledSize: '5', avgPrice: '40.5' })
    const [submitArgs] = (exchange.submit as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(submitArgs?.action).toMatchObject({
      orders: [
        {
          a: 10_005,
          b: false,
          s: '5',
          t: { limit: { tif: 'Ioc' } },
        },
      ],
    })
    // mid = 40.55, sell with 50bps slippage => 40.55 * 0.995 = 40.347...
    const submitted = submitArgs?.action as { orders: { p: string }[] }
    const px = Number(submitted.orders[0]?.p)
    expect(px).toBeGreaterThan(40.3)
    expect(px).toBeLessThan(40.4)
  })

  it('rejects a pair where USDH is neither base nor quote', async () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeOk({ type: 'order', data: { statuses: [] } }),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(
      orders.placeOrder({ pair: 'HYPE/USDC', side: 'buy', size: '1', price: '40' }),
    ).rejects.toThrow(/USDH as base or quote/)
  })

  it('rejects an unknown pair name', async () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeOk({ type: 'order', data: { statuses: [] } }),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(
      orders.placeOrder({ pair: 'NOPE/USDH', side: 'buy', size: '1', price: '1' }),
    ).rejects.toBeInstanceOf(InvalidInputError)
  })

  it('rejects tif on a market order', async () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeOk({ type: 'order', data: { statuses: [] } }),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(
      orders.placeOrder({ pair: 'USDH/USDC', side: 'buy', size: '1', tif: 'Gtc' }),
    ).rejects.toThrow(/market orders force tif=Ioc/)
  })

  it('rejects slippageBps on a limit order', async () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeOk({ type: 'order', data: { statuses: [] } }),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(
      orders.placeOrder({
        pair: 'USDH/USDC',
        side: 'buy',
        size: '1',
        price: '1',
        slippageBps: 10,
      }),
    ).rejects.toThrow(/slippageBps only applies to market orders/)
  })

  it('rejects an invalid side', async () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeOk({ type: 'order', data: { statuses: [] } }),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
      orders.placeOrder({ pair: 'USDH/USDC', side: 'long' as any, size: '1', price: '1' }),
    ).rejects.toBeInstanceOf(InvalidInputError)
  })

  it('surfaces an order-level error from the exchange', async () => {
    const exchange = exchangeOk({
      type: 'order',
      data: { statuses: [{ error: 'Order must have minimum value of $10.' }] },
    })
    const orders = createOrders({
      info: stubInfo(),
      exchange,
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(
      orders.placeOrder({ pair: 'USDH/USDC', side: 'buy', size: '1', price: '1' }),
    ).rejects.toMatchObject({
      name: 'NetworkError',
      message: /minimum value of \$10/,
    })
  })

  it('surfaces a top-level err from the exchange', async () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeErr('rate limited'),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(
      orders.placeOrder({ pair: 'USDH/USDC', side: 'buy', size: '1', price: '1' }),
    ).rejects.toThrow(/exchange error: rate limited/)
  })
})

describe('cancelOrder', () => {
  it('cancels by oid against the right asset index', async () => {
    const exchange = exchangeOk({ type: 'cancel', data: { statuses: ['success'] } })
    const orders = createOrders({
      info: stubInfo(),
      exchange,
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    const result = await orders.cancelOrder({ pair: 'HYPE/USDH', oid: 12345 })
    expect(result).toEqual({ oid: 12345 })
    const [submitArgs] = (exchange.submit as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(submitArgs?.action).toEqual({
      type: 'cancel',
      cancels: [{ a: 10_005, o: 12345 }],
    })
  })

  it('rejects a non-USDH pair', async () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeOk({ type: 'cancel', data: { statuses: ['success'] } }),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(orders.cancelOrder({ pair: 'HYPE/USDC', oid: 1 })).rejects.toThrow(
      /USDH as base or quote/,
    )
  })

  it('throws on a non-success cancel status', async () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeOk({
        type: 'cancel',
        data: { statuses: [{ error: 'Order was never placed, already canceled, or filled.' }] },
      }),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(orders.cancelOrder({ pair: 'USDH/USDC', oid: 1 })).rejects.toThrow(
      /cancel error: Order was never placed/,
    )
  })

  it('rejects a negative oid synchronously', async () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeOk({ type: 'cancel', data: { statuses: ['success'] } }),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await expect(orders.cancelOrder({ pair: 'USDH/USDC', oid: -1 })).rejects.toBeInstanceOf(
      InvalidInputError,
    )
  })
})

describe('getOpenOrders / getOrderStatus', () => {
  it('forwards getOpenOrders to info.frontendOpenOrders with the configured account', async () => {
    const frontendOpenOrders = vi.fn(async () => [])
    const orders = createOrders({
      info: stubInfo({ frontendOpenOrders }),
      exchange: exchangeOk({}),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await orders.getOpenOrders()
    expect(frontendOpenOrders).toHaveBeenCalledWith(ACCOUNT)
  })

  it('forwards getOrderStatus to info.orderStatus', async () => {
    const orderStatus = vi.fn(async () => ({ status: 'unknownOid' }) as const)
    const orders = createOrders({
      info: stubInfo({ orderStatus }),
      exchange: exchangeOk({}),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    await orders.getOrderStatus(42)
    expect(orderStatus).toHaveBeenCalledWith(ACCOUNT, 42)
  })

  it('rejects a negative oid in getOrderStatus', () => {
    const orders = createOrders({
      info: stubInfo(),
      exchange: exchangeOk({}),
      signer: stubSigner(),
      network: 'mainnet',
      accountAddress: ACCOUNT,
      nextNonce: nonceFactory(),
    })
    expect(() => orders.getOrderStatus(-5)).toThrow(InvalidInputError)
  })
})
