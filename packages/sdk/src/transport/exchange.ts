import { InvalidInputError, NetworkError } from '../errors.js'
import type { L1Signature } from '../signing.js'
import type { Address } from '../types/hex.js'
import type { Network } from '../types/network.js'

const ENDPOINTS: Record<Network, string> = {
  mainnet: 'https://api.hyperliquid.xyz/exchange',
  testnet: 'https://api.hyperliquid-testnet.xyz/exchange',
}

const DEFAULT_TIMEOUT_MS = 10_000

export interface ExchangeClientConfig {
  network: Network
  /** Override the global fetch. */
  fetch?: typeof fetch
  /** Per-request timeout. Defaults to 10s. */
  timeoutMs?: number
}

export interface SubmitArgs {
  action: unknown
  signature: L1Signature
  /** Nonce in milliseconds since epoch (HL spec). */
  nonce: bigint
  vaultAddress?: Address
}

export interface ExchangeClient {
  /** Submit a signed L1 action to /exchange. Returns the parsed response. */
  submit(args: SubmitArgs): Promise<ExchangeResponse>
}

/**
 * Top-level /exchange response. `status: 'err'` carries a string message;
 * action-level errors (per-order errors on a multi-order request) come
 * back inside `response` with `status: 'ok'`.
 */
export type ExchangeResponse =
  | { status: 'ok'; response: unknown }
  | { status: 'err'; response: string }

/**
 * Response shape for `order` action. Use the runtime guard
 * `isOrderResponse` before narrowing into `data.statuses`.
 */
export interface OrderResponse {
  type: 'order'
  data: { statuses: OrderStatus[] }
}

export type OrderStatus =
  | { filled: { totalSz: string; avgPx: string; oid: number } }
  | { resting: { oid: number } }
  | { error: string }

export function isOrderResponse(value: unknown): value is OrderResponse {
  if (value === null || typeof value !== 'object') return false
  const v = value as { type?: unknown; data?: unknown }
  if (v.type !== 'order') return false
  if (v.data === null || typeof v.data !== 'object') return false
  const d = v.data as { statuses?: unknown }
  return Array.isArray(d.statuses)
}

export function createExchangeClient(config: ExchangeClientConfig): ExchangeClient {
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

  return {
    async submit(args): Promise<ExchangeResponse> {
      const body = {
        action: args.action,
        nonce: Number(args.nonce),
        signature: args.signature,
        ...(args.vaultAddress !== undefined && { vaultAddress: args.vaultAddress }),
      }

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

      if (data === null || typeof data !== 'object') {
        throw new NetworkError('unexpected /exchange response shape')
      }
      const d = data as { status?: unknown; response?: unknown }
      if (d.status !== 'ok' && d.status !== 'err') {
        throw new NetworkError(`unexpected /exchange status: ${String(d.status)}`)
      }
      if (d.status === 'err' && typeof d.response !== 'string') {
        throw new NetworkError('/exchange err response is not a string')
      }

      return data as ExchangeResponse
    },
  }
}
