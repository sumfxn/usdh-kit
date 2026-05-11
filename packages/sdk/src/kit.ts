import { runBridgeFromCore, runBridgeToCore } from './bridge.js'
import {
  type GetMidsOpts,
  type GetUsdhPairInput,
  type ListUsdhPairsOpts,
  type UsdhPair,
  createDiscovery,
} from './discovery.js'
import {
  BridgeAndSwapError,
  InsufficientBalanceError,
  InvalidInputError,
  MissingEvmWalletError,
  NetworkError,
  NotImplementedError,
} from './errors.js'
import {
  type CancelOrderInput,
  type CancelOrderResult,
  type GetOpenOrdersInput,
  type GetOrderStatusInput,
  type PlaceOrderInput,
  type PlaceOrderResult,
  createOrders,
} from './orders.js'
import {
  type GetOutcomeBookInput,
  type GetOutcomeMarketInput,
  type UsdhOutcomeMarket,
  createOutcomeDiscovery,
} from './outcomes.js'
import { type ResolvedPair, createPairResolver } from './pair-resolver.js'
import {
  applyPrice,
  applyPriceInverse,
  formatDecimal,
  formatSpotPrice,
  midPrice18,
  parseDecimal,
} from './pricing.js'
import { signL1Action } from './signing.js'
import {
  type ExchangeClient,
  type ExchangeResponse,
  type OrderStatus,
  createExchangeClient,
  isOrderResponse,
} from './transport/exchange.js'
import { type InfoClient, type NSigFigs, createInfoClient } from './transport/info.js'
import type { L2Book, OpenOrder, OrderStatusResponse } from './transport/types.js'
import type {
  BridgeFromCoreInput,
  BridgeFromCoreResult,
  BridgeInput,
  BridgeResult,
} from './types/bridge.js'
import type { KitConfig } from './types/config.js'
import type { Logger } from './types/logger.js'
import { silentLogger } from './types/logger.js'
import type {
  BridgeAndSwapInput,
  BridgeAndSwapResult,
  HypercoreBalance,
  HypercoreBalanceInput,
  Quote,
  QuoteInput,
  RouteInput,
  SourceChain,
  SwapAsset,
  SwapInput,
  SwapResult,
  SwapRoute,
  TargetStable,
} from './types/swap.js'

const DEFAULT_SLIPPAGE_BPS = 20
const QUOTE_TTL_MS = 30_000
const STABLE_DECIMALS = 6
const PRICE_DECIMALS = 18
const MIN_ORDER_SOURCE_AMOUNT = 10_000_001n
const TEN_PRICE = 10n ** BigInt(PRICE_DECIMALS)
const HC_FEE_BUFFER_BPS = 10n
const BPS_DENOMINATOR = 10_000n
const ORDER_EXPIRES_AFTER_MS = 30_000n

export interface UsdhKit {
  readonly network: KitConfig['network']
  swap(input: SwapInput): Promise<SwapResult>
  getQuote(input: QuoteInput): Promise<Quote>
  /** Return the user's HyperCore source-token balance net of held open-order funds. */
  getHypercoreBalance(input: HypercoreBalanceInput): Promise<HypercoreBalance>
  /**
   * Resolve the recommended source chain for a swap. `auto` prefers a direct
   * HyperCore swap when the user has enough source balance there, otherwise
   * routes through the HyperEVM bridge. EVM ERC20 balance is not inspected.
   */
  getRoute(input: RouteInput): Promise<SwapRoute>
  /** Alias of `getRoute` for apps that want preflight semantics in UI code. */
  preflightSwap(input: RouteInput): Promise<SwapRoute>
  /**
   * High-level helper for the common retail path: route, bridge when needed,
   * then swap. Emits optional lifecycle events for progress UI.
   */
  bridgeAndSwap(input: BridgeAndSwapInput): Promise<BridgeAndSwapResult>
  /**
   * Bridge a stable from HyperEVM to HyperCore. USDC uses Circle's native
   * CoreDepositWallet flow; other linked spot assets use the system-address
   * transfer path. Resolves once HyperCore credits the deposit (poll, default
   * timeout 180s). Requires `KitConfig.evmWallet`.
   */
  bridgeToCore(input: BridgeInput): Promise<BridgeResult>
  /**
   * Bridge a linked spot asset from HyperCore to HyperEVM by sending it to the
   * token's system address. Requires the configured signer to be the master
   * account because the HyperEVM recipient is the sender of the Core action.
   */
  bridgeFromCore(input: BridgeFromCoreInput): Promise<BridgeFromCoreResult>
  /** List USDH-bearing spot pairs from `spotMeta`. Cached after the first call. */
  listPairs(opts?: ListUsdhPairsOpts): Promise<UsdhPair[]>
  /** Find one USDH-bearing spot pair by base/quote token names. */
  getPair(input: GetUsdhPairInput): Promise<UsdhPair>
  /** Fetch the L2 book for a live pair name, usually `@<spotIndex>`. */
  getBook(pair: string, opts?: { nSigFigs?: NSigFigs }): Promise<L2Book>
  /** Fetch mid prices, optionally filtered to USDH-quote pairs. */
  getMids(opts?: GetMidsOpts): Promise<Record<string, string>>
  /** List experimental read-only outcome markets from Hyperliquid outcome metadata. */
  listOutcomeMarkets(): Promise<UsdhOutcomeMarket[]>
  /** Find one experimental read-only outcome market by numeric outcome id. */
  getOutcomeMarket(input: GetOutcomeMarketInput): Promise<UsdhOutcomeMarket>
  /** Fetch the L2 book for one experimental outcome side. */
  getOutcomeBook(input: GetOutcomeBookInput): Promise<L2Book>
  /** Fetch mid prices keyed by encoded outcome side coin, e.g. `#200`. */
  getOutcomeMids(): Promise<Record<string, string>>
  /** Place a USDH-pair spot order. Accepts `listPairs()` names or token aliases like `USDH/USDC`. */
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>
  /** Cancel a resting USDH-pair order by oid. */
  cancelOrder(input: CancelOrderInput): Promise<CancelOrderResult>
  /** List the user's USDH-pair resting open orders, optionally filtered to one pair. */
  getOpenOrders(input?: GetOpenOrdersInput): Promise<OpenOrder[]>
  /** Fetch a single USDH-pair order's status by pair and oid. */
  getOrderStatus(input: GetOrderStatusInput): Promise<OrderStatusResponse>
}

/**
 * Create a kit bound to a network and signer. Validates input synchronously
 * and lazily resolves the USDH/USDC pair on first call.
 */
export function createUsdhKit(config: KitConfig): UsdhKit {
  validateConfig(config)
  const defaultSlippageBps = config.slippageBps ?? DEFAULT_SLIPPAGE_BPS
  const logger = config.logger ?? silentLogger
  const accountAddress = normalizeAddress(config.accountAddress ?? config.signer.address)
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
  const discovery = createDiscovery(info)
  const outcomeDiscovery = createOutcomeDiscovery(info)
  let lastNonce = 0n

  function nextNonce(): bigint {
    const now = BigInt(Date.now())
    const candidate = now > lastNonce ? now : lastNonce + 1n
    lastNonce = candidate
    return candidate
  }

  const orders = createOrders({
    info,
    exchange,
    signer: config.signer,
    network: config.network,
    accountAddress,
    nextNonce,
  })

  async function swap(input: SwapInput): Promise<SwapResult> {
    validateSwapInput(input)
    const direction = resolveSwapDirection(input)
    const slippageBps = input.slippageBps ?? defaultSlippageBps
    assertDirectionSlippage(direction, slippageBps)
    if (direction.from === 'USDT') {
      throw new NotImplementedError('USDT swap lands in a follow-up PR')
    }
    if (input.amount < MIN_ORDER_SOURCE_AMOUNT) {
      throw new InvalidInputError(
        `amount must be greater than 10 ${direction.from} for Hyperliquid spot orders`,
      )
    }
    logger.debug('swap.requested', {
      from: direction.from,
      to: direction.to,
      amount: input.amount.toString(),
      slippageBps,
    })

    const pair = await resolvePair()
    const book = await info.l2Book(pair.name)
    const mid = midPrice18(book)

    const limitPrice18 =
      direction.side === 'buy'
        ? (mid * (10_000n + BigInt(slippageBps))) / 10_000n
        : (mid * (10_000n - BigInt(slippageBps))) / 10_000n
    const limitPriceStr = formatSpotPrice(limitPrice18, pair.baseSzDecimals)
    const sizeUsdh =
      direction.side === 'buy'
        ? applyPriceInverse(input.amount, parseDecimal(limitPriceStr, PRICE_DECIMALS))
        : input.amount
    if (sizeUsdh === 0n) {
      throw new InvalidInputError('amount too small to fill at the slippage-tolerant limit')
    }
    const sizeStr = formatDecimal(sizeUsdh, STABLE_DECIMALS, pair.baseSzDecimals)

    const action = buildOrderAction(pair, direction.side, limitPriceStr, sizeStr)
    const nonce = nextNonce()
    const expiresAfter = nonce + ORDER_EXPIRES_AFTER_MS

    logger.debug('swap.signing', { pair: pair.name, nonce: nonce.toString() })
    const signature = await signL1Action({
      signer: config.signer,
      action,
      nonce,
      network: config.network,
      expiresAfter,
    })

    logger.debug('swap.submitting', { pair: pair.name })
    const response: ExchangeResponse = await exchange.submit({
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

    return finalizeFill(status, mid, direction, logger)
  }

  return {
    network: config.network,
    swap,

    async getHypercoreBalance(input: HypercoreBalanceInput): Promise<HypercoreBalance> {
      assertBalanceAsset(input.asset)
      const meta = await info.spotMeta()
      const token = meta.tokens.find((t) => t.name === input.asset)
      if (!token) {
        throw new NetworkError(`${input.asset} token not found in spotMeta`)
      }
      return readHypercoreBalance(info, accountAddress, input.asset, token.index, token.weiDecimals)
    },

    async getRoute(input: RouteInput): Promise<SwapRoute> {
      return getRoute(input)
    },

    async preflightSwap(input: RouteInput): Promise<SwapRoute> {
      return getRoute(input)
    },

    async bridgeAndSwap(input: BridgeAndSwapInput): Promise<BridgeAndSwapResult> {
      let route: SwapRoute
      try {
        route = await getRoute(input)
      } catch (err) {
        if (err instanceof InvalidInputError || err instanceof NotImplementedError) throw err
        throw new BridgeAndSwapError('route', err)
      }
      input.onProgress?.({ phase: 'route', route })

      if (!route.canSwap) {
        if (route.blockReason === 'missing_evm_wallet') {
          throw new MissingEvmWalletError()
        }
        throw new InsufficientBalanceError(
          route.requiredHypercoreBalance,
          route.hypercoreBalance,
          route.from,
        )
      }

      let bridge: BridgeResult | undefined
      if (route.requiresBridge) {
        input.onProgress?.({ phase: 'bridging', route })
        try {
          bridge = await runBridgeToCore(
            {
              asset: route.from as BridgeInput['asset'],
              amount: input.amount,
              user: accountAddress,
              ...(input.waitForCreditTimeoutMs !== undefined && {
                waitForCreditTimeoutMs: input.waitForCreditTimeoutMs,
              }),
            },
            {
              info,
              evmWallet: config.evmWallet,
              network: config.network,
              logger,
            },
          )
        } catch (err) {
          throw new BridgeAndSwapError('bridging', err, route)
        }
      }

      input.onProgress?.({ phase: 'swapping', route, ...(bridge !== undefined && { bridge }) })
      let swapResult: SwapResult
      try {
        swapResult = await swap(input)
      } catch (err) {
        throw new BridgeAndSwapError('swapping', err, route, bridge)
      }
      const result: BridgeAndSwapResult = {
        route,
        ...(bridge !== undefined && { bridge }),
        swap: swapResult,
      }
      input.onProgress?.({ phase: 'done', route, result })
      return result
    },

    async bridgeToCore(input: BridgeInput): Promise<BridgeResult> {
      return runBridgeToCore(
        { ...input, user: accountAddress },
        {
          info,
          evmWallet: config.evmWallet,
          network: config.network,
          logger,
        },
      )
    },

    async bridgeFromCore(input: BridgeFromCoreInput): Promise<BridgeFromCoreResult> {
      return runBridgeFromCore(input, {
        info,
        exchange,
        signer: config.signer,
        network: config.network,
        logger,
        accountAddress,
      })
    },

    listPairs(opts) {
      return discovery.listPairs(opts)
    },

    getPair(input) {
      return discovery.getPair(input)
    },

    getBook(pair, opts) {
      return discovery.getBook(pair, opts)
    },

    getMids(opts) {
      return discovery.getMids(opts)
    },

    listOutcomeMarkets() {
      return outcomeDiscovery.listOutcomeMarkets()
    },

    getOutcomeMarket(input) {
      return outcomeDiscovery.getOutcomeMarket(input)
    },

    getOutcomeBook(input) {
      return outcomeDiscovery.getOutcomeBook(input)
    },

    getOutcomeMids() {
      return outcomeDiscovery.getOutcomeMids()
    },

    placeOrder(input) {
      return orders.placeOrder(input)
    },

    cancelOrder(input) {
      return orders.cancelOrder(input)
    },

    getOpenOrders(input) {
      return orders.getOpenOrders(input)
    },

    getOrderStatus(input) {
      return orders.getOrderStatus(input)
    },

    async getQuote(input: QuoteInput): Promise<Quote> {
      validateQuoteInput(input)
      const direction = resolveSwapDirection(input)
      if (direction.from === 'USDT') {
        throw new NotImplementedError('USDT pricing lands in a follow-up PR')
      }
      logger.debug('quote.requested', {
        from: direction.from,
        to: direction.to,
        amount: input.amount.toString(),
      })
      const pair = await resolvePair()
      const book = await info.l2Book(pair.name)
      const midPrice = midPrice18(book)
      const estimatedReceived =
        direction.side === 'buy'
          ? applyPriceInverse(input.amount, midPrice)
          : applyPrice(input.amount, midPrice)
      return {
        from: direction.from,
        to: direction.to,
        estimatedReceived,
        midPrice,
        pair: pair.name,
        validUntil: Date.now() + QUOTE_TTL_MS,
      }
    },
  }

  async function getRoute(input: RouteInput): Promise<SwapRoute> {
    validateRouteInput(input)
    const direction = resolveSwapDirection(input)
    if (direction.from === 'USDT') {
      throw new NotImplementedError('USDT routing lands in a follow-up PR')
    }
    if (direction.side === 'sell' && input.sourceChain === 'hyperevm') {
      throw new InvalidInputError('USDH -> USDC only supports sourceChain=hypercore')
    }

    const slippageBps = input.slippageBps ?? defaultSlippageBps
    assertDirectionSlippage(direction, slippageBps)
    const belowMinOrderValue = input.amount < MIN_ORDER_SOURCE_AMOUNT
    const pair = await resolvePair()
    const book = await info.l2Book(pair.name)
    const midPrice = midPrice18(book)
    const estimatedReceived =
      direction.side === 'buy'
        ? applyPriceInverse(input.amount, midPrice)
        : applyPrice(input.amount, midPrice)
    const quote: Quote = {
      from: direction.from,
      to: direction.to,
      estimatedReceived,
      midPrice,
      pair: pair.name,
      validUntil: Date.now() + QUOTE_TTL_MS,
    }

    const sourceTokenIndex = direction.side === 'buy' ? pair.tokens[1] : pair.tokens[0]
    const sourceWeiDecimals =
      direction.side === 'buy' ? pair.quoteWeiDecimals : pair.baseWeiDecimals
    const hypercore = await readHypercoreBalance(
      info,
      accountAddress,
      direction.from,
      sourceTokenIndex,
      sourceWeiDecimals,
    )
    const hypercoreBalance = hypercore.available
    const requiredSourceAmount =
      direction.side === 'buy'
        ? input.amount +
          (input.amount * (BigInt(slippageBps) + HC_FEE_BUFFER_BPS)) / BPS_DENOMINATOR
        : input.amount
    const requiredHypercoreBalance = scaleAmount(
      requiredSourceAmount,
      STABLE_DECIMALS,
      sourceWeiDecimals,
    )
    const hypercoreCovers = hypercoreBalance >= requiredHypercoreBalance
    const requestedSource = input.sourceChain ?? 'auto'
    const sourceChain: SourceChain =
      direction.side === 'sell'
        ? 'hypercore'
        : requestedSource === 'auto'
          ? hypercoreCovers
            ? 'hypercore'
            : 'hyperevm'
          : requestedSource
    const requiresBridge = sourceChain === 'hyperevm'
    const canSwap =
      !belowMinOrderValue && (requiresBridge ? config.evmWallet !== undefined : hypercoreCovers)

    return {
      from: direction.from,
      to: direction.to,
      amount: input.amount,
      sourceChain,
      requiresBridge,
      canSwap,
      ...(!canSwap &&
        (belowMinOrderValue
          ? { blockReason: 'below_min_order_value' as const }
          : requiresBridge
            ? { blockReason: 'missing_evm_wallet' as const }
            : { blockReason: 'insufficient_hypercore_balance' as const })),
      quote,
      hypercoreBalance,
      hypercoreTotal: hypercore.total,
      hypercoreHold: hypercore.hold,
      hypercoreDecimals: sourceWeiDecimals,
      requiredHypercoreBalance,
    }
  }
}

type SwapDirection =
  | { from: 'USDC'; to: 'USDH'; side: 'buy' }
  | { from: 'USDH'; to: 'USDC'; side: 'sell' }
  | { from: 'USDT'; to: 'USDH'; side: 'buy' }

function buildOrderAction(
  pair: ResolvedPair,
  side: SwapDirection['side'],
  priceStr: string,
  sizeStr: string,
): unknown {
  return {
    type: 'order',
    orders: [
      {
        a: pair.assetIndex,
        b: side === 'buy',
        p: priceStr,
        s: sizeStr,
        r: false,
        t: { limit: { tif: 'Ioc' } },
      },
    ],
    grouping: 'na',
  }
}

function finalizeFill(
  status: OrderStatus,
  midPrice: bigint,
  direction: SwapDirection,
  logger: Logger,
): SwapResult {
  if ('error' in status) {
    throw new NetworkError(`order error: ${status.error}`)
  }
  if ('resting' in status) {
    throw new NetworkError('IOC order rested unexpectedly')
  }
  const { totalSz, avgPx, oid } = status.filled
  const filledBase = parseDecimal(totalSz, STABLE_DECIMALS)
  const fillPrice18 = parseDecimal(avgPx, PRICE_DECIMALS)
  const received = direction.side === 'buy' ? filledBase : (filledBase * fillPrice18) / TEN_PRICE
  const spent = direction.side === 'buy' ? (filledBase * fillPrice18) / TEN_PRICE : filledBase
  const diff = fillPrice18 - midPrice
  const absDiff = diff < 0n ? -diff : diff
  const slippageBps = midPrice === 0n ? 0 : Number((absDiff * 10_000n) / midPrice)
  logger.info('swap.filled', {
    oid,
    from: direction.from,
    to: direction.to,
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

async function readHypercoreBalance(
  info: InfoClient,
  user: KitConfig['signer']['address'],
  asset: SwapAsset,
  tokenIndex: number,
  decimals: number,
): Promise<HypercoreBalance> {
  const state = await info.spotClearinghouseState(user)
  const row = state.balances.find((b) => b.token === tokenIndex)
  const total = row ? parseDecimal(row.total, decimals) : 0n
  const hold = row ? parseDecimal(row.hold, decimals) : 0n
  const available = total > hold ? total - hold : 0n
  return { asset, tokenIndex, decimals, total, hold, available }
}

function scaleAmount(amount: bigint, fromDecimals: number, toDecimals: number): bigint {
  const diff = toDecimals - fromDecimals
  if (diff === 0) return amount
  if (diff > 0) return amount * 10n ** BigInt(diff)
  return amount / 10n ** BigInt(-diff)
}

function validateConfig(config: KitConfig): void {
  if (config.network !== 'mainnet' && config.network !== 'testnet') {
    throw new InvalidInputError(`network must be 'mainnet' or 'testnet'`)
  }
  if (config.signer === undefined || config.signer === null) {
    throw new InvalidInputError('signer is required')
  }
  if (config.accountAddress !== undefined) {
    normalizeAddress(config.accountAddress)
  }
  if (config.slippageBps !== undefined) {
    assertSlippage(config.slippageBps)
  }
}

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

function normalizeAddress(address: KitConfig['signer']['address']): KitConfig['signer']['address'] {
  if (!ADDRESS_PATTERN.test(address)) {
    throw new InvalidInputError(`address is not a 20-byte hex address: ${address}`)
  }
  return address.toLowerCase() as KitConfig['signer']['address']
}

function validateSwapInput(input: SwapInput): void {
  assertFromAndAmount(input.from, input.amount)
  if (input.slippageBps !== undefined) {
    assertSlippage(input.slippageBps)
  }
}

function validateRouteInput(input: RouteInput): void {
  validateSwapInput(input)
  if (
    input.sourceChain !== undefined &&
    input.sourceChain !== 'auto' &&
    input.sourceChain !== 'hypercore' &&
    input.sourceChain !== 'hyperevm'
  ) {
    throw new InvalidInputError(`sourceChain must be 'auto', 'hypercore', or 'hyperevm'`)
  }
}

function validateQuoteInput(input: QuoteInput): void {
  assertFromAndAmount(input.from, input.amount)
  resolveSwapDirection(input)
}

function resolveSwapDirection(input: { from: SwapAsset; to?: TargetStable }): SwapDirection {
  assertSwapAsset(input.from)
  if (input.from === 'USDC') {
    if (input.to !== undefined && input.to !== 'USDH') {
      throw new InvalidInputError(`to must be 'USDH' when from is 'USDC'`)
    }
    return { from: 'USDC', to: 'USDH', side: 'buy' }
  }
  if (input.from === 'USDH') {
    if (input.to !== undefined && input.to !== 'USDC') {
      throw new InvalidInputError(`to must be 'USDC' when from is 'USDH'`)
    }
    return { from: 'USDH', to: 'USDC', side: 'sell' }
  }
  if (input.to !== undefined && input.to !== 'USDH') {
    throw new InvalidInputError(`to must be 'USDH' when from is 'USDT'`)
  }
  return { from: 'USDT', to: 'USDH', side: 'buy' }
}

function assertFromAndAmount(from: unknown, amount: unknown): void {
  assertSwapAsset(from)
  if (typeof amount !== 'bigint' || amount <= 0n) {
    throw new InvalidInputError('amount must be a positive bigint')
  }
}

function assertSwapAsset(from: unknown): asserts from is SwapAsset {
  if (from !== 'USDC' && from !== 'USDT' && from !== 'USDH') {
    throw new InvalidInputError(`from must be 'USDC', 'USDH', or 'USDT'`)
  }
}

function assertBalanceAsset(asset: unknown): asserts asset is SwapAsset {
  if (asset !== 'USDC' && asset !== 'USDT' && asset !== 'USDH') {
    throw new InvalidInputError(`asset must be 'USDC', 'USDH', or 'USDT'`)
  }
}

function assertSlippage(bps: number): void {
  if (!Number.isFinite(bps) || !Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new InvalidInputError('slippageBps must be an integer in [0, 10000]')
  }
}

function assertDirectionSlippage(direction: SwapDirection, bps: number): void {
  assertSlippage(bps)
  if (direction.side === 'sell' && bps >= 10_000) {
    throw new InvalidInputError('slippageBps must be less than 10000 for USDH -> USDC')
  }
}
