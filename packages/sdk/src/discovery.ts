import { NetworkError } from './errors.js'
import type { InfoClient, NSigFigs } from './transport/info.js'
import type { L2Book, SpotMeta, SpotPair, SpotToken } from './transport/types.js'

const USDH_TOKEN_NAME = 'USDH'
const USDC_TOKEN_NAME = 'USDC'

export interface UsdhPair {
  kind: 'spot'
  /** Pair name as used by HL info endpoints, usually `@<spotIndex>` for spot. */
  name: string
  /** Base token name. */
  base: string
  /** Quote token name. */
  quote: string
  /**
   * Whether USDH is the base or quote of the pair. `undefined` for pairs that
   * do not involve USDH (e.g. HYPE/USDC).
   */
  usdhRole?: 'base' | 'quote'
  /** Index into `spotMeta.universe`. */
  index: number
  /** Token indices [base, quote]. */
  tokens: [number, number]
}

export interface ListUsdhPairsOpts {
  /**
   * Filter by quote token. Defaults to `'USDC'` (USDC-quoted pairs).
   * Pass `'USDH'` to opt into the legacy USDH-quoted pair list.
   */
  quote?: 'USDH' | 'USDC'
  kind?: 'spot'
}

export interface GetUsdhPairInput {
  base: string
  quote: string
  kind?: 'spot'
}

export interface GetMidsOpts {
  /**
   * Filter mid prices by quote token. Defaults to `'USDC'` (USDC-quoted pairs
   * only). Pass `'USDH'` to get USDH-quoted pair mids instead.
   */
  quote?: 'USDH' | 'USDC'
}

/**
 * Build a `UsdhPair` for every spot pair where USDH appears as base or quote.
 * Token names are resolved against `spotMeta.tokens`; pair indices come from
 * `pair.index`, not the array position.
 */
export function listUsdhSpotPairs(meta: SpotMeta): UsdhPair[] {
  const usdh = meta.tokens.find((t) => t.name === USDH_TOKEN_NAME)
  if (usdh === undefined) {
    throw new NetworkError(`${USDH_TOKEN_NAME} token not found in spotMeta`)
  }
  const tokens = tokenIndexMap(meta.tokens)
  const out: UsdhPair[] = []
  for (const pair of meta.universe) {
    const [baseIdx, quoteIdx] = pair.tokens
    if (baseIdx !== usdh.index && quoteIdx !== usdh.index) continue
    const baseToken = tokens.get(baseIdx)
    const quoteToken = tokens.get(quoteIdx)
    if (baseToken === undefined || quoteToken === undefined) continue
    out.push({
      kind: 'spot',
      name: pair.name,
      base: baseToken.name,
      quote: quoteToken.name,
      usdhRole: baseIdx === usdh.index ? 'base' : 'quote',
      index: pair.index,
      tokens: pair.tokens,
    })
  }
  return out
}

/**
 * Build a `UsdhPair` record for every spot pair in `spotMeta`, regardless of
 * whether USDH is involved. `usdhRole` is set only when USDH appears as base
 * or quote; it is `undefined` for pairs such as HYPE/USDC.
 */
function listAllSpotPairs(meta: SpotMeta): UsdhPair[] {
  const tokens = tokenIndexMap(meta.tokens)
  const usdhIndex = meta.tokens.find((t) => t.name === USDH_TOKEN_NAME)?.index
  const out: UsdhPair[] = []
  for (const pair of meta.universe) {
    const [baseIdx, quoteIdx] = pair.tokens
    const baseToken = tokens.get(baseIdx)
    const quoteToken = tokens.get(quoteIdx)
    if (baseToken === undefined || quoteToken === undefined) continue
    out.push(spotPairToUsdhPair(pair, baseToken, quoteToken, usdhIndex))
  }
  return out
}

function spotPairToUsdhPair(
  pair: SpotPair,
  baseToken: SpotToken,
  quoteToken: SpotToken,
  usdhIndex: number | undefined,
): UsdhPair {
  const base: UsdhPair = {
    kind: 'spot',
    name: pair.name,
    base: baseToken.name,
    quote: quoteToken.name,
    index: pair.index,
    tokens: pair.tokens,
  }
  if (usdhIndex !== undefined && pair.tokens[0] === usdhIndex) {
    return { ...base, usdhRole: 'base' }
  }
  if (usdhIndex !== undefined && pair.tokens[1] === usdhIndex) {
    return { ...base, usdhRole: 'quote' }
  }
  return base
}

/**
 * Find a single USDH-bearing spot pair by base/quote token names. Orientation
 * is strict: `{ base: 'HYPE', quote: 'USDH' }` will not match `USDH/HYPE`.
 */
export function findUsdhSpotPair(meta: SpotMeta, input: GetUsdhPairInput): UsdhPair {
  if (input.base !== USDH_TOKEN_NAME && input.quote !== USDH_TOKEN_NAME) {
    throw new NetworkError(`pair must have ${USDH_TOKEN_NAME} as base or quote`)
  }
  const match = listUsdhSpotPairs(meta).find(
    (p) => p.base === input.base && p.quote === input.quote,
  )
  if (match === undefined) {
    throw new NetworkError(`pair ${input.base}/${input.quote} not found in spotMeta`)
  }
  return match
}

/**
 * Cache-aware listing of spot pairs. Defaults to USDC-quoted pairs; pass
 * `{ quote: 'USDH' }` to opt into the legacy USDH-quoted pair list.
 * Caches `spotMeta` once and indexes all pairs by name so repeated `getPair`
 * lookups do not refetch.
 */
export function createDiscovery(info: InfoClient): {
  listPairs(opts?: ListUsdhPairsOpts): Promise<UsdhPair[]>
  getPair(input: GetUsdhPairInput): Promise<UsdhPair>
  getBook(pair: string, opts?: { nSigFigs?: NSigFigs }): Promise<L2Book>
  getMids(opts?: GetMidsOpts): Promise<Record<string, string>>
} {
  let allPairsCache: Promise<UsdhPair[]> | null = null
  /** Index by `@<index>` name for O(1) lookups. */
  let byName: Map<string, UsdhPair> | null = null

  async function loadAllPairs(): Promise<UsdhPair[]> {
    if (allPairsCache === null) {
      allPairsCache = info.spotMeta().then((meta) => {
        const pairs = listAllSpotPairs(meta)
        byName = new Map(pairs.map((p) => [p.name, p]))
        return pairs
      })
    }
    return allPairsCache
  }

  return {
    async listPairs(opts) {
      assertSpotKind(opts?.kind)
      const pairs = await loadAllPairs()
      // Default to USDC-quoted pairs; pass `quote: 'USDH'` for the legacy path.
      const quoteFilter = opts?.quote ?? USDC_TOKEN_NAME
      return pairs.filter((p) => p.quote === quoteFilter)
    },
    async getPair(input) {
      assertSpotKind(input.kind)
      const pairs = await loadAllPairs()
      // Fast path: try the canonical `@<index>` name form if stored by name.
      const cached = byName?.get(`${input.base}/${input.quote}`)
      if (cached !== undefined) return cached
      const match = pairs.find((p) => p.base === input.base && p.quote === input.quote)
      if (match === undefined) {
        throw new NetworkError(`pair ${input.base}/${input.quote} not found in spotMeta`)
      }
      return match
    },
    getBook(pair, opts) {
      return info.l2Book(pair, opts?.nSigFigs)
    },
    async getMids(opts) {
      const all = await info.allMids()
      // Default to USDC-quoted pairs; pass `quote: 'USDH'` for the legacy path.
      const quoteFilter = opts?.quote ?? USDC_TOKEN_NAME
      const pairs = await loadAllPairs()
      const out: Record<string, string> = {}
      for (const p of pairs) {
        if (p.quote !== quoteFilter) continue
        const mid = all[p.name] ?? all[`@${p.index}`]
        if (mid !== undefined) out[p.name] = mid
      }
      return out
    },
  }
}

function assertSpotKind(kind: string | undefined): void {
  if (kind !== undefined && kind !== 'spot') {
    throw new NetworkError(`unsupported pair kind: ${kind}`)
  }
}

function tokenIndexMap(tokens: SpotToken[]): Map<number, SpotToken> {
  return new Map(tokens.map((token) => [token.index, token]))
}
