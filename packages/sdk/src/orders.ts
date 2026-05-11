import { type UsdhPair, findUsdhSpotPair, listUsdhSpotPairs } from './discovery.js'
import { InvalidInputError, NetworkError } from './errors.js'
import { formatDecimal, formatSpotPrice, midPrice18, parseDecimal } from './pricing.js'
import { signL1Action } from './signing.js'
import {
  type ExchangeClient,
  type ExchangeResponse,
  isOrderResponse,
} from './transport/exchange.js'
import type { InfoClient } from './transport/info.js'
import type { OpenOrder, OrderStatusResponse } from './transport/types.js'
import type { Address } from './types/hex.js'
import type { Network } from './types/network.js'
import type { Signer } from './types/signer.js'

const SPOT_ASSET_OFFSET = 10_000
const PRICE_DECIMALS = 18
const ORDER_EXPIRES_AFTER_MS = 30_000n
const DEFAULT_MARKET_SLIPPAGE_BPS = 50

export type OrderSide = 'buy' | 'sell'
export type Tif = 'Gtc' | 'Ioc' | 'Alo'

export interface PlaceOrderInput {
  /** USDH-bearing spot pair. Accepts `listPairs()` names like `@230` or aliases like `USDH/USDC`. */
  pair: string
  side: OrderSide
  /** Size in base-token units, decimal string (e.g. "1.5"). */
  size: string
  /** Limit price in quote-per-base, decimal string. Omit for a market order. */
  price?: string
  /** Time-in-force. Defaults to 'Gtc' for limit; ignored for market. */
  tif?: Tif
  /** Reduce-only flag. Defaults to false. */
  reduceOnly?: boolean
  /** Slippage tolerance for market orders. Defaults to 50 bps. */
  slippageBps?: number
}

export interface PlaceOrderResult {
  oid: number
  /** "filled" if the order completed at submission, "resting" if it sits on the book. */
  status: 'filled' | 'resting'
  /** Filled size in base units (decimal string). Empty for resting. */
  filledSize: string
  /** Average fill price (decimal string). Empty for resting. */
  avgPrice: string
}

export interface CancelOrderInput {
  /** USDH-bearing spot pair. Accepts `listPairs()` names like `@230` or aliases like `USDH/USDC`. */
  pair: string
  /** Order id to cancel. */
  oid: number
}

export interface CancelOrderResult {
  oid: number
}

export interface GetOpenOrdersInput {
  /** Optional USDH-bearing spot pair filter. Accepts the same formats as `placeOrder`. */
  pair?: string
}

export interface GetOrderStatusInput {
  /** USDH-bearing spot pair the order is expected to belong to. */
  pair: string
  /** Order id to inspect. */
  oid: number
}

export interface OrdersDeps {
  info: InfoClient
  exchange: ExchangeClient
  signer: Signer
  network: Network
  /** Account whose orders are read. Defaults to `signer.address`. */
  accountAddress: Address
  nextNonce(): bigint
}

interface PairContext {
  pair: UsdhPair
  baseSzDecimals: number
  assetIndex: number
}

/**
 * Build a Track 3 USDH-only order layer on top of the existing transport.
 * Lookups go through `findUsdhSpotPair` so callers cannot place orders on
 * pairs where USDH is neither base nor quote.
 */
export function createOrders(deps: OrdersDeps): {
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>
  cancelOrder(input: CancelOrderInput): Promise<CancelOrderResult>
  getOpenOrders(input?: GetOpenOrdersInput): Promise<OpenOrder[]>
  getOrderStatus(input: GetOrderStatusInput): Promise<OrderStatusResponse>
} {
  return {
    async placeOrder(input) {
      const ctx = await resolvePairContext(deps.info, input.pair)
      const isMarket = input.price === undefined
      validatePlaceOrder(input, isMarket)

      const sizeStr = normalizeSize(input.size, ctx.baseSzDecimals)
      const priceStr = isMarket
        ? await marketLimitPrice(deps.info, ctx, input.side, input.slippageBps)
        : formatSpotPrice(parseDecimal(input.price as string, PRICE_DECIMALS), ctx.baseSzDecimals)

      const tif: Tif = isMarket ? 'Ioc' : (input.tif ?? 'Gtc')
      const action = {
        type: 'order',
        orders: [
          {
            a: ctx.assetIndex,
            b: input.side === 'buy',
            p: priceStr,
            s: sizeStr,
            r: input.reduceOnly ?? false,
            t: { limit: { tif } },
          },
        ],
        grouping: 'na',
      }

      const nonce = deps.nextNonce()
      const expiresAfter = nonce + ORDER_EXPIRES_AFTER_MS
      const signature = await signL1Action({
        signer: deps.signer,
        action,
        nonce,
        network: deps.network,
        expiresAfter,
      })

      const response: ExchangeResponse = await deps.exchange.submit({
        action,
        signature,
        nonce,
        expiresAfter,
      })
      if (response.status === 'err') {
        throw new NetworkError(`exchange error: ${response.response}`)
      }
      if (!isOrderResponse(response.response)) {
        throw new NetworkError('unexpected /exchange response shape for order action')
      }
      const status = response.response.data.statuses[0]
      if (status === undefined) {
        throw new NetworkError('exchange returned no order status')
      }
      if ('error' in status) {
        throw new NetworkError(`order error: ${status.error}`)
      }
      if ('filled' in status) {
        return {
          oid: status.filled.oid,
          status: 'filled',
          filledSize: status.filled.totalSz,
          avgPrice: status.filled.avgPx,
        }
      }
      return {
        oid: status.resting.oid,
        status: 'resting',
        filledSize: '',
        avgPrice: '',
      }
    },

    async cancelOrder(input) {
      const ctx = await resolvePairContext(deps.info, input.pair)
      validateOid(input.oid)
      const action = {
        type: 'cancel',
        cancels: [{ a: ctx.assetIndex, o: input.oid }],
      }
      const nonce = deps.nextNonce()
      const expiresAfter = nonce + ORDER_EXPIRES_AFTER_MS
      const signature = await signL1Action({
        signer: deps.signer,
        action,
        nonce,
        network: deps.network,
        expiresAfter,
      })
      const response: ExchangeResponse = await deps.exchange.submit({
        action,
        signature,
        nonce,
        expiresAfter,
      })
      if (response.status === 'err') {
        throw new NetworkError(`exchange error: ${response.response}`)
      }
      const inner = response.response as { type?: unknown; data?: unknown }
      if (inner.type !== 'cancel' || !isRecord(inner.data)) {
        throw new NetworkError('unexpected /exchange response shape for cancel action')
      }
      const statuses = (inner.data as { statuses?: unknown }).statuses
      if (!Array.isArray(statuses) || statuses[0] === undefined) {
        throw new NetworkError('cancel returned no status')
      }
      const first = statuses[0]
      if (first !== 'success') {
        const msg =
          isRecord(first) && 'error' in first
            ? String((first as { error: unknown }).error)
            : String(first)
        throw new NetworkError(`cancel error: ${msg}`)
      }
      return { oid: input.oid }
    },

    async getOpenOrders(input) {
      const pair = readOptionalPair(input)
      const pairFilter = pair === undefined ? null : await resolveOrderCoinNames(deps.info, pair)
      const openOrders = await deps.info.frontendOpenOrders(deps.accountAddress)
      if (pairFilter !== null) {
        return openOrders.filter((order) => pairFilter.has(order.coin))
      }
      if (openOrders.length === 0) {
        return []
      }
      const usdhCoins = await resolveOrderCoinNames(deps.info)
      return openOrders.filter((order) => usdhCoins.has(order.coin))
    },

    async getOrderStatus(input) {
      if (!isRecord(input)) {
        throw new InvalidInputError('order status input must include pair and oid')
      }
      const { oid, pair } = input
      assertPairInput(pair)
      validateOid(oid)
      const ctx = await resolvePairContext(deps.info, pair)
      const status = await deps.info.orderStatus(deps.accountAddress, oid)
      if (status.status === 'unknownOid') {
        return status
      }
      if (!orderMatchesPair(status.order.order, ctx.pair)) {
        throw new InvalidInputError(`order ${oid} is not on USDH pair ${ctx.pair.name}`)
      }
      return status
    },
  }
}

function validatePlaceOrder(input: PlaceOrderInput, isMarket: boolean): void {
  if (input.side !== 'buy' && input.side !== 'sell') {
    throw new InvalidInputError(`side must be 'buy' or 'sell'`)
  }
  if (typeof input.size !== 'string' || input.size.length === 0) {
    throw new InvalidInputError('size must be a non-empty decimal string')
  }
  if (input.tif !== undefined && !['Gtc', 'Ioc', 'Alo'].includes(input.tif)) {
    throw new InvalidInputError(`tif must be 'Gtc', 'Ioc', or 'Alo'`)
  }
  if (isMarket && input.tif !== undefined && input.tif !== 'Ioc') {
    throw new InvalidInputError('market orders force tif=Ioc; omit tif')
  }
  if (input.slippageBps !== undefined) {
    if (
      !Number.isFinite(input.slippageBps) ||
      !Number.isInteger(input.slippageBps) ||
      input.slippageBps < 0 ||
      input.slippageBps > 10_000
    ) {
      throw new InvalidInputError('slippageBps must be an integer in [0, 10000]')
    }
    if (!isMarket) {
      throw new InvalidInputError('slippageBps only applies to market orders')
    }
  }
}

function normalizeSize(size: string, szDecimals: number): string {
  const parsed = parseDecimal(size, szDecimals)
  if (parsed === 0n) {
    throw new InvalidInputError('size must be greater than zero')
  }
  return formatDecimal(parsed, szDecimals)
}

async function marketLimitPrice(
  info: InfoClient,
  ctx: PairContext,
  side: OrderSide,
  slippageBps: number | undefined,
): Promise<string> {
  const bps = slippageBps ?? DEFAULT_MARKET_SLIPPAGE_BPS
  const book = await info.l2Book(ctx.pair.name)
  const mid = midPrice18(book)
  const adjusted =
    side === 'buy'
      ? (mid * (10_000n + BigInt(bps))) / 10_000n
      : (mid * (10_000n - BigInt(bps))) / 10_000n
  if (adjusted <= 0n) {
    throw new InvalidInputError('slippage-adjusted price is non-positive')
  }
  return formatSpotPrice(adjusted, ctx.baseSzDecimals)
}

async function resolvePairContext(info: InfoClient, pairInput: string): Promise<PairContext> {
  assertPairInput(pairInput)
  const meta = await info.spotMeta()
  const tokens = new Map(meta.tokens.map((t) => [t.index, t]))
  const universePair = meta.universe.find((p) => p.name === pairInput)
  if (universePair !== undefined) {
    const baseToken = tokens.get(universePair.tokens[0])
    const quoteToken = tokens.get(universePair.tokens[1])
    if (baseToken === undefined || quoteToken === undefined) {
      throw new NetworkError(`token metadata missing for pair ${pairInput}`)
    }
    const pair = findInputUsdhSpotPair(meta, { base: baseToken.name, quote: quoteToken.name })
    return {
      pair,
      baseSzDecimals: baseToken.szDecimals,
      assetIndex: SPOT_ASSET_OFFSET + pair.index,
    }
  }

  const alias = parsePairAlias(pairInput)
  if (alias === null) {
    throw new InvalidInputError(`pair ${pairInput} not found in spotMeta`)
  }
  const pair = findInputUsdhSpotPair(meta, alias)
  const baseToken = tokens.get(pair.tokens[0])
  if (baseToken === undefined) {
    throw new NetworkError(`token metadata missing for pair ${pairInput}`)
  }
  return {
    pair,
    baseSzDecimals: baseToken.szDecimals,
    assetIndex: SPOT_ASSET_OFFSET + pair.index,
  }
}

async function resolveOrderCoinNames(info: InfoClient, pairInput?: string): Promise<Set<string>> {
  if (pairInput !== undefined) {
    const ctx = await resolvePairContext(info, pairInput)
    return orderCoinNames(ctx.pair)
  }
  const meta = await info.spotMeta()
  const names = new Set<string>()
  for (const pair of listUsdhSpotPairs(meta)) {
    for (const name of orderCoinNames(pair)) {
      names.add(name)
    }
  }
  return names
}

function readOptionalPair(input: GetOpenOrdersInput | undefined): string | undefined {
  if (input === undefined) {
    return undefined
  }
  if (!isRecord(input)) {
    throw new InvalidInputError('open orders input must be an object')
  }
  const { pair } = input
  if (pair === undefined) {
    return undefined
  }
  assertPairInput(pair)
  return pair
}

function assertPairInput(pair: unknown): asserts pair is string {
  if (typeof pair !== 'string' || pair.length === 0) {
    throw new InvalidInputError('pair must be a non-empty string')
  }
}

function parsePairAlias(pair: string): { base: string; quote: string } | null {
  const parts = pair.split('/')
  if (parts.length !== 2) {
    return null
  }
  const base = parts[0]
  const quote = parts[1]
  if (base === undefined || quote === undefined || base === '' || quote === '') {
    return null
  }
  return { base, quote }
}

function findInputUsdhSpotPair(
  meta: Parameters<typeof findUsdhSpotPair>[0],
  input: Parameters<typeof findUsdhSpotPair>[1],
): UsdhPair {
  try {
    return findUsdhSpotPair(meta, input)
  } catch (error) {
    if (error instanceof NetworkError && error.message.startsWith('pair ')) {
      throw new InvalidInputError(error.message)
    }
    throw error
  }
}

function orderCoinNames(pair: UsdhPair): Set<string> {
  return new Set([pair.name, `${pair.base}/${pair.quote}`])
}

function orderMatchesPair(order: { coin: string }, pair: UsdhPair): boolean {
  return orderCoinNames(pair).has(order.coin)
}

function validateOid(oid: unknown): asserts oid is number {
  if (!Number.isInteger(oid) || typeof oid !== 'number' || oid < 0) {
    throw new InvalidInputError('oid must be a non-negative integer')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
