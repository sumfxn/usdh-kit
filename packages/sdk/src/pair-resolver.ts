import { NetworkError } from './errors.js'
import type { InfoClient } from './transport/info.js'
import type { SpotMeta, SpotToken } from './transport/types.js'

export interface ResolvedPair {
  /** Pair name as used by HL info endpoints, usually `@<spotIndex>` for spot. */
  name: string
  /** Index into `spotMeta.universe`. */
  index: number
  /** Asset index used in `/exchange` order actions: `10000 + index` for spot. */
  assetIndex: number
  /** Token indices [base, quote]. */
  tokens: [number, number]
  /** Base token size decimals (HL `szDecimals`). */
  baseSzDecimals: number
  /** Base token wei decimals (HL `weiDecimals` of the base token). */
  baseWeiDecimals: number
  /** Quote token wei decimals (HL `weiDecimals` of the quote token). */
  quoteWeiDecimals: number
}

const SPOT_ASSET_OFFSET = 10000

/**
 * Find the canonical USDH/USDC pair in spotMeta. Tokens are matched by name
 * to avoid hardcoded indices, but orientation is intentionally strict because
 * swap() buys the base token with the quote token.
 */
export function findUsdhUsdcPair(meta: SpotMeta): ResolvedPair {
  const usdc = meta.tokens.find((t) => t.name === 'USDC')
  const usdh = meta.tokens.find((t) => t.name === 'USDH')
  if (!usdc) {
    throw new NetworkError('USDC token not found in spotMeta')
  }
  if (!usdh) {
    throw new NetworkError('USDH token not found in spotMeta')
  }
  const pair = meta.universe.find((p) => p.tokens[0] === usdh.index && p.tokens[1] === usdc.index)
  if (!pair) {
    throw new NetworkError(
      'USDH/USDC pair not found in spotMeta with USDH as base and USDC as quote',
    )
  }
  const tokens = tokenIndexMap(meta.tokens)
  const baseToken = tokens.get(pair.tokens[0])
  const quoteToken = tokens.get(pair.tokens[1])
  if (baseToken === undefined || quoteToken === undefined) {
    throw new NetworkError('pair token indices do not resolve in spotMeta')
  }
  return {
    name: pair.name,
    index: pair.index,
    assetIndex: SPOT_ASSET_OFFSET + pair.index,
    tokens: pair.tokens,
    baseSzDecimals: baseToken.szDecimals,
    baseWeiDecimals: baseToken.weiDecimals,
    quoteWeiDecimals: quoteToken.weiDecimals,
  }
}

function tokenIndexMap(tokens: SpotToken[]): Map<number, SpotToken> {
  return new Map(tokens.map((token) => [token.index, token]))
}

/**
 * Lazily resolve USDH/USDC and cache the result for the lifetime of the kit.
 */
export function createPairResolver(info: InfoClient): () => Promise<ResolvedPair> {
  let cached: Promise<ResolvedPair> | null = null
  return () => {
    if (cached === null) {
      cached = info.spotMeta().then(findUsdhUsdcPair)
    }
    return cached
  }
}
