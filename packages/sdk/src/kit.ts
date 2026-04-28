import { InvalidInputError, NotImplementedError } from './errors.js'
import { createPairResolver } from './pair-resolver.js'
import { applyPriceInverse, midPrice18 } from './pricing.js'
import { type InfoClient, createInfoClient } from './transport/info.js'
import type { KitConfig } from './types/config.js'
import { silentLogger } from './types/logger.js'
import type { Quote, QuoteInput, SwapInput, SwapResult } from './types/swap.js'

const DEFAULT_SLIPPAGE_BPS = 20
const QUOTE_TTL_MS = 30_000

export interface UsdhKit {
  readonly network: KitConfig['network']
  swap(input: SwapInput): Promise<SwapResult>
  getQuote(input: QuoteInput): Promise<Quote>
}

/**
 * Create a kit bound to a network and signer. Validates input synchronously.
 * `swap` throws `NotImplementedError` until execution lands.
 */
export function createUsdhKit(config: KitConfig): UsdhKit {
  validateConfig(config)
  const slippageBps = config.slippageBps ?? DEFAULT_SLIPPAGE_BPS
  const logger = config.logger ?? silentLogger
  const info: InfoClient = createInfoClient({
    network: config.network,
    ...(config.fetch !== undefined && { fetch: config.fetch }),
    ...(config.timeoutMs !== undefined && { timeoutMs: config.timeoutMs }),
  })
  const resolvePair = createPairResolver(info)

  return {
    network: config.network,

    async swap(input: SwapInput): Promise<SwapResult> {
      validateSwapInput(input)
      logger.debug('swap.requested', {
        from: input.from,
        amount: input.amount.toString(),
        slippageBps: input.slippageBps ?? slippageBps,
      })
      throw new NotImplementedError('swap() lands in a follow-up PR')
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
