import { runBridgeToCore } from './bridge.js'
import { InvalidInputError, NetworkError, NotImplementedError } from './errors.js'
import { type ResolvedPair, createPairResolver } from './pair-resolver.js'
import { applyPriceInverse, formatDecimal, midPrice18, parseDecimal } from './pricing.js'
import { signL1Action } from './signing.js'
import {
  type ExchangeClient,
  type ExchangeResponse,
  type OrderStatus,
  createExchangeClient,
  isOrderResponse,
} from './transport/exchange.js'
import { type InfoClient, createInfoClient } from './transport/info.js'
import type { L2Book } from './transport/types.js'
import type { BridgeInput, BridgeResult } from './types/bridge.js'
import type { KitConfig } from './types/config.js'
import type { Logger } from './types/logger.js'
import { silentLogger } from './types/logger.js'
import type { Quote, QuoteInput, SwapInput, SwapResult } from './types/swap.js'

const DEFAULT_SLIPPAGE_BPS = 20
const QUOTE_TTL_MS = 30_000
const STABLE_DECIMALS = 6
const PRICE_DECIMALS = 18
const TEN_PRICE = 10n ** BigInt(PRICE_DECIMALS)

export interface UsdhKit {
  readonly network: KitConfig['network']
  swap(input: SwapInput): Promise<SwapResult>
  getQuote(input: QuoteInput): Promise<Quote>
  /**
   * Bridge a stable from HyperEVM to HyperCore by sending the asset's ERC20
   * to its HyperCore system address. Resolves once HyperCore credits the
   * deposit (poll, default timeout 30s). Requires `KitConfig.evmWallet`.
   */
  bridgeToCore(input: BridgeInput): Promise<BridgeResult>
}

/**
 * Create a kit bound to a network and signer. Validates input synchronously
 * and lazily resolves the USDH/USDC pair on first call.
 */
export function createUsdhKit(config: KitConfig): UsdhKit {
  validateConfig(config)
  const defaultSlippageBps = config.slippageBps ?? DEFAULT_SLIPPAGE_BPS
  const logger = config.logger ?? silentLogger
  const info: InfoClient = createInfoClient({
    network: config.network,
    ...(config.fetch !== undefined && { fetch: config.fetch }),
    ...(config.timeoutMs !== undefined && { timeoutMs: config.timeoutMs }),
  })
  const exchange: ExchangeClient = createExchangeClient({
    network: config.network,
    ...(config.fetch !== undefined && { fetch: config.fetch }),
    ...(config.timeoutMs !== undefined && { timeoutMs: config.timeoutMs }),
  })
  const resolvePair = createPairResolver(info)
  let lastNonce = 0n

  function nextNonce(): bigint {
    const now = BigInt(Date.now())
    const candidate = now > lastNonce ? now : lastNonce + 1n
    lastNonce = candidate
    return candidate
  }

  return {
    network: config.network,

    async swap(input: SwapInput): Promise<SwapResult> {
      validateSwapInput(input)
      const slippageBps = input.slippageBps ?? defaultSlippageBps
      if (input.from === 'USDT') {
        throw new NotImplementedError('USDT swap lands in a follow-up PR')
      }
      logger.debug('swap.requested', {
        from: input.from,
        amount: input.amount.toString(),
        slippageBps,
      })

      const pair = await resolvePair()
      const book = await info.l2Book(pair.name)
      const mid = midPrice18(book)
      assertBookHasSides(book)

      const limitPrice18 = (mid * (10_000n + BigInt(slippageBps))) / 10_000n
      const limitPriceStr = formatDecimal(limitPrice18, PRICE_DECIMALS, pair.quoteWeiDecimals)
      const sizeUsdh = applyPriceInverse(input.amount, limitPrice18)
      if (sizeUsdh === 0n) {
        throw new InvalidInputError('amount too small to fill at the slippage-tolerant limit')
      }
      const sizeStr = formatDecimal(sizeUsdh, STABLE_DECIMALS, pair.baseSzDecimals)

      const action = buildOrderAction(pair, limitPriceStr, sizeStr)
      const nonce = nextNonce()

      logger.debug('swap.signing', { pair: pair.name, nonce: nonce.toString() })
      const signature = await signL1Action({
        signer: config.signer,
        action,
        nonce,
        network: config.network,
      })

      logger.debug('swap.submitting', { pair: pair.name })
      const response: ExchangeResponse = await exchange.submit({ action, signature, nonce })
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

      return finalizeFill(status, mid, logger)
    },

    async bridgeToCore(input: BridgeInput): Promise<BridgeResult> {
      return runBridgeToCore(
        { ...input, user: config.signer.address },
        {
          info,
          evmWallet: config.evmWallet,
          network: config.network,
          logger,
        },
      )
    },

    async getQuote(input: QuoteInput): Promise<Quote> {
      validateQuoteInput(input)
      if (input.from === 'USDT') {
        throw new NotImplementedError('USDT pricing lands in a follow-up PR')
      }
      logger.debug('quote.requested', {
        from: input.from,
        amount: input.amount.toString(),
      })
      const pair = await resolvePair()
      const book = await info.l2Book(pair.name)
      const midPrice = midPrice18(book)
      const estimatedReceived = applyPriceInverse(input.amount, midPrice)
      return {
        estimatedReceived,
        midPrice,
        pair: pair.name,
        validUntil: Date.now() + QUOTE_TTL_MS,
      }
    },
  }
}

function assertBookHasSides(book: L2Book): void {
  const [bids, asks] = book.levels
  if (bids[0] === undefined || asks[0] === undefined) {
    throw new NetworkError(`orderbook ${book.coin} is missing a side`)
  }
}

function buildOrderAction(pair: ResolvedPair, priceStr: string, sizeStr: string): unknown {
  return {
    type: 'order',
    orders: [
      {
        a: pair.assetIndex,
        b: true,
        p: priceStr,
        s: sizeStr,
        r: false,
        t: { limit: { tif: 'Ioc' } },
      },
    ],
    grouping: 'na',
  }
}

function finalizeFill(status: OrderStatus, midPrice: bigint, logger: Logger): SwapResult {
  if ('error' in status) {
    throw new NetworkError(`order error: ${status.error}`)
  }
  if ('resting' in status) {
    throw new NetworkError('IOC order rested unexpectedly')
  }
  const { totalSz, avgPx, oid } = status.filled
  const received = parseDecimal(totalSz, STABLE_DECIMALS)
  const fillPrice18 = parseDecimal(avgPx, PRICE_DECIMALS)
  const spent = (received * fillPrice18) / TEN_PRICE
  const diff = fillPrice18 - midPrice
  const absDiff = diff < 0n ? -diff : diff
  const slippageBps = midPrice === 0n ? 0 : Number((absDiff * 10_000n) / midPrice)
  logger.info('swap.filled', {
    oid,
    received: received.toString(),
    spent: spent.toString(),
    slippageBps,
  })
  return {
    orderId: oid.toString(),
    received,
    spent,
    price: fillPrice18,
    slippageBps,
  }
}

function validateConfig(config: KitConfig): void {
  if (config.network !== 'mainnet' && config.network !== 'testnet') {
    throw new InvalidInputError(`network must be 'mainnet' or 'testnet'`)
  }
  if (config.signer === undefined || config.signer === null) {
    throw new InvalidInputError('signer is required')
  }
  if (config.slippageBps !== undefined) {
    assertSlippage(config.slippageBps)
  }
}

function validateSwapInput(input: SwapInput): void {
  assertFromAndAmount(input.from, input.amount)
  if (input.slippageBps !== undefined) {
    assertSlippage(input.slippageBps)
  }
}

function validateQuoteInput(input: QuoteInput): void {
  assertFromAndAmount(input.from, input.amount)
}

function assertFromAndAmount(from: unknown, amount: unknown): void {
  if (from !== 'USDC' && from !== 'USDT') {
    throw new InvalidInputError(`from must be 'USDC' or 'USDT'`)
  }
  if (typeof amount !== 'bigint' || amount <= 0n) {
    throw new InvalidInputError('amount must be a positive bigint')
  }
}

function assertSlippage(bps: number): void {
  if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) {
    throw new InvalidInputError('slippageBps must be a finite number in [0, 10000]')
  }
}
