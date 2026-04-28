import { NetworkError } from './errors.js'
import type { InfoClient } from './transport/info.js'
import type { SpotMeta } from './transport/types.js'

export interface ResolvedPair {
  /** Pair name as used by HL info endpoints (e.g. "USDH/USDC"). */
  name: string
  /** Index into `spotMeta.universe`. */
  index: number
  /** Token indices [base, quote]. */
  tokens: [number, number]
}

/**
 * Find the canonical USDH/USDC pair in spotMeta. Tokens are matched by name
 * to avoid hardcoded indices.
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
  const pair = meta.universe.find(
    (p) =>
      (p.tokens[0] === usdh.index && p.tokens[1] === usdc.index) ||
      (p.tokens[0] === usdc.index && p.tokens[1] === usdh.index),
  )
  if (!pair) {
    throw new NetworkError('USDH/USDC pair not found in spotMeta')
  }
  return { name: pair.name, index: pair.index, tokens: pair.tokens }
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
