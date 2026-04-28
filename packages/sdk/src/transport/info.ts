import { InvalidInputError, NetworkError } from '../errors.js'
import type { Network } from '../types/network.js'
import type { L2Book, SpotMeta } from './types.js'

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
  l2Book(coin: string, nSigFigs?: NSigFigs): Promise<L2Book>
}

export function createInfoClient(config: InfoClientConfig): InfoClient {
  const url = ENDPOINTS[config.network]
  const fetchImpl = config.fetch ?? globalThis.fetch
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS

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
    l2Book(coin, nSigFigs) {
      if (nSigFigs !== undefined && ![2, 3, 4, 5].includes(nSigFigs)) {
        throw new InvalidInputError('nSigFigs must be 2, 3, 4, or 5')
      }
      return post<L2Book>({ type: 'l2Book', coin, nSigFigs: nSigFigs ?? null })
    },
  }
}
