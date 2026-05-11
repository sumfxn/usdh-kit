import { InvalidInputError, NetworkError } from '../errors.js'
import type { Address } from '../types/hex.js'
import type { Network } from '../types/network.js'
import type {
  L2Book,
  OpenOrder,
  OrderStatusResponse,
  OutcomeMeta,
  OutcomeMetaQuestion,
  OutcomeSideSpec,
  SpotClearinghouseState,
  SpotMeta,
} from './types.js'

const ENDPOINTS: Record<Network, string> = {
  mainnet: 'https://api.hyperliquid.xyz/info',
  testnet: 'https://api.hyperliquid-testnet.xyz/info',
}

const DEFAULT_TIMEOUT_MS = 10_000

export interface InfoClientConfig {
  network: Network
  /** Override the global fetch. Useful for testing or custom transports. */
  fetch?: typeof fetch
  /** Per-request timeout. Defaults to 10s. */
  timeoutMs?: number
}

export type NSigFigs = 2 | 3 | 4 | 5

export interface InfoClient {
  spotMeta(): Promise<SpotMeta>
  outcomeMeta(): Promise<OutcomeMeta>
  l2Book(coin: string, nSigFigs?: NSigFigs): Promise<L2Book>
  spotClearinghouseState(user: Address): Promise<SpotClearinghouseState>
  /** Returns mid prices keyed by coin name (perps) or `@<spotIndex>` (spot). */
  allMids(): Promise<Record<string, string>>
  /** Resting open orders for a user, with extended frontend fields. */
  frontendOpenOrders(user: Address): Promise<OpenOrder[]>
  /** Status of a single order by oid. */
  orderStatus(user: Address, oid: number): Promise<OrderStatusResponse>
}

export function createInfoClient(config: InfoClientConfig): InfoClient {
  const url = ENDPOINTS[config.network]
  const fetchImpl = config.fetch ?? globalThis.fetch
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (url === undefined) {
    throw new InvalidInputError(`network must be 'mainnet' or 'testnet'`)
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new InvalidInputError('timeoutMs must be a positive number')
  }
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetch is not available; provide config.fetch')
  }

  async function post<T>(body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      const msg = aborted
        ? `request to ${url} timed out after ${timeoutMs}ms`
        : `request to ${url} failed`
      throw new NetworkError(msg, undefined, { cause: err })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) {
      throw new NetworkError(`HTTP ${res.status} from ${url}`, res.status)
    }
    let data: unknown
    try {
      data = await res.json()
    } catch (err) {
      throw new NetworkError(`invalid JSON from ${url}`, undefined, { cause: err })
    }
    if (
      data !== null &&
      typeof data === 'object' &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'string'
    ) {
      throw new NetworkError(`HL error: ${(data as { error: string }).error}`)
    }
    return data as T
  }

  return {
    spotMeta() {
      return post<SpotMeta>({ type: 'spotMeta' })
    },
    outcomeMeta() {
      return post<unknown>({ type: 'outcomeMeta' }).then(assertOutcomeMeta)
    },
    l2Book(coin, nSigFigs) {
      if (nSigFigs !== undefined && ![2, 3, 4, 5].includes(nSigFigs)) {
        throw new InvalidInputError('nSigFigs must be 2, 3, 4, or 5')
      }
      return post<unknown>({ type: 'l2Book', coin, nSigFigs: nSigFigs ?? null }).then((data) =>
        assertL2Book(data, coin),
      )
    },
    spotClearinghouseState(user) {
      return post<SpotClearinghouseState>({ type: 'spotClearinghouseState', user })
    },
    allMids() {
      return post<unknown>({ type: 'allMids' }).then(assertAllMids)
    },
    frontendOpenOrders(user) {
      return post<unknown>({ type: 'frontendOpenOrders', user }).then(assertOpenOrders)
    },
    orderStatus(user, oid) {
      if (!Number.isInteger(oid) || oid < 0) {
        throw new InvalidInputError('oid must be a non-negative integer')
      }
      return post<unknown>({ type: 'orderStatus', user, oid }).then(assertOrderStatus)
    },
  }
}

function assertOutcomeMeta(data: unknown): OutcomeMeta {
  const meta = data as { outcomes?: unknown; questions?: unknown }
  if (!isRecord(data) || !Array.isArray(meta.outcomes)) {
    throw new NetworkError('invalid outcomeMeta response')
  }
  const outcomes = meta.outcomes.map(assertOutcomeMetaOutcome)
  const questionsRaw = meta.questions
  if (questionsRaw !== undefined && !Array.isArray(questionsRaw)) {
    throw new NetworkError('invalid outcomeMeta questions')
  }
  const questions = questionsRaw?.map(assertOutcomeMetaQuestion)
  return questions === undefined ? { outcomes } : { outcomes, questions }
}

function assertOutcomeMetaOutcome(value: unknown): OutcomeMeta['outcomes'][number] {
  if (!isRecord(value)) {
    throw new NetworkError('invalid outcomeMeta outcome')
  }
  const outcomeRaw = value as {
    outcome?: unknown
    name?: unknown
    description?: unknown
    sideSpecs?: unknown
  }
  const outcome = outcomeRaw.outcome
  const name = outcomeRaw.name
  const description = outcomeRaw.description
  const sideSpecs = outcomeRaw.sideSpecs
  if (
    !isSafeNonNegativeInteger(outcome) ||
    typeof name !== 'string' ||
    typeof description !== 'string' ||
    !Array.isArray(sideSpecs) ||
    sideSpecs.length !== 2
  ) {
    throw new NetworkError('invalid outcomeMeta outcome')
  }
  const yes = assertOutcomeSideSpec(sideSpecs[0])
  const no = assertOutcomeSideSpec(sideSpecs[1])
  return { outcome, name, description, sideSpecs: [yes, no] }
}

function assertOutcomeSideSpec(value: unknown): OutcomeSideSpec {
  const sideSpec = value as { name?: unknown }
  if (!isRecord(value) || typeof sideSpec.name !== 'string') {
    throw new NetworkError('invalid outcomeMeta sideSpec')
  }
  return { name: sideSpec.name }
}

function assertOutcomeMetaQuestion(value: unknown): OutcomeMetaQuestion {
  if (!isRecord(value)) {
    throw new NetworkError('invalid outcomeMeta question')
  }
  const questionRaw = value as {
    question?: unknown
    name?: unknown
    description?: unknown
    fallbackOutcome?: unknown
    namedOutcomes?: unknown
    settledNamedOutcomes?: unknown
  }
  const question = questionRaw.question
  const name = questionRaw.name
  const description = questionRaw.description
  const fallbackOutcome = questionRaw.fallbackOutcome
  const namedOutcomes = questionRaw.namedOutcomes
  const settledNamedOutcomes = questionRaw.settledNamedOutcomes
  if (
    !isSafeNonNegativeInteger(question) ||
    typeof name !== 'string' ||
    typeof description !== 'string' ||
    !isSafeNonNegativeInteger(fallbackOutcome) ||
    !isSafeIntegerArray(namedOutcomes) ||
    !isSafeIntegerArray(settledNamedOutcomes)
  ) {
    throw new NetworkError('invalid outcomeMeta question')
  }
  return {
    question,
    name,
    description,
    fallbackOutcome,
    namedOutcomes,
    settledNamedOutcomes,
  }
}

function assertL2Book(data: unknown, coin: string): L2Book {
  if (!isRecord(data)) {
    throw new NetworkError(`invalid l2Book response for ${coin}`)
  }
  const book = data as { coin?: unknown; time?: unknown; levels?: unknown }
  const levels = book.levels
  if (
    book.coin !== coin ||
    typeof book.time !== 'number' ||
    !Array.isArray(levels) ||
    levels.length !== 2 ||
    !Array.isArray(levels[0]) ||
    !Array.isArray(levels[1]) ||
    !levels[0].every(isL2Level) ||
    !levels[1].every(isL2Level)
  ) {
    throw new NetworkError(`invalid l2Book response for ${coin}`)
  }
  return data as unknown as L2Book
}

function assertOpenOrders(data: unknown): OpenOrder[] {
  if (!Array.isArray(data)) {
    throw new NetworkError('invalid frontendOpenOrders response')
  }
  for (const item of data) {
    if (!isOpenOrder(item)) {
      throw new NetworkError('invalid frontendOpenOrders entry')
    }
  }
  return data as OpenOrder[]
}

function isOpenOrder(value: unknown): boolean {
  if (!isRecord(value)) return false
  const v = value as {
    coin?: unknown
    side?: unknown
    limitPx?: unknown
    sz?: unknown
    origSz?: unknown
    oid?: unknown
    timestamp?: unknown
    reduceOnly?: unknown
    orderType?: unknown
    triggerCondition?: unknown
    triggerPx?: unknown
    isPositionTpsl?: unknown
    isTrigger?: unknown
  }
  return (
    typeof v.coin === 'string' &&
    (v.side === 'A' || v.side === 'B') &&
    typeof v.limitPx === 'string' &&
    typeof v.sz === 'string' &&
    typeof v.origSz === 'string' &&
    typeof v.oid === 'number' &&
    typeof v.timestamp === 'number' &&
    typeof v.reduceOnly === 'boolean' &&
    typeof v.orderType === 'string' &&
    typeof v.triggerCondition === 'string' &&
    typeof v.triggerPx === 'string' &&
    typeof v.isPositionTpsl === 'boolean' &&
    typeof v.isTrigger === 'boolean'
  )
}

function assertOrderStatus(data: unknown): OrderStatusResponse {
  if (!isRecord(data)) {
    throw new NetworkError('invalid orderStatus response')
  }
  const v = data as { status?: unknown; order?: unknown }
  if (v.status === 'unknownOid') {
    return { status: 'unknownOid' }
  }
  if (v.status !== 'order' || !isRecord(v.order)) {
    throw new NetworkError('invalid orderStatus response')
  }
  const detail = v.order as { order?: unknown; status?: unknown; statusTimestamp?: unknown }
  if (
    !isRecord(detail.order) ||
    typeof detail.status !== 'string' ||
    typeof detail.statusTimestamp !== 'number'
  ) {
    throw new NetworkError('invalid orderStatus detail')
  }
  return data as OrderStatusResponse
}

function assertAllMids(data: unknown): Record<string, string> {
  if (!isRecord(data)) {
    throw new NetworkError('invalid allMids response')
  }
  for (const [coin, mid] of Object.entries(data)) {
    if (typeof mid !== 'string') {
      throw new NetworkError(`invalid allMids response for ${coin}`)
    }
  }
  return data as Record<string, string>
}

function isL2Level(value: unknown): boolean {
  const level = value as { px?: unknown; sz?: unknown; n?: unknown }
  return (
    isRecord(value) &&
    typeof level.px === 'string' &&
    typeof level.sz === 'string' &&
    typeof level.n === 'number'
  )
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isSafeIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isSafeNonNegativeInteger)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
