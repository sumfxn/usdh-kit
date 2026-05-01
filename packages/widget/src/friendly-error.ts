import {
  BridgeTimeoutError,
  InsufficientBalanceError,
  InvalidInputError,
  MissingEvmWalletError,
  NetworkError,
  NotImplementedError,
  SigningError,
  UsdhKitError,
  isBridgeAndSwapError,
} from '@usdh-kit/sdk'

const VIEM_USER_REJECTED_NAMES = new Set([
  'UserRejectedRequestError',
  'UserRejectedRequestErrorType',
])

const HL_PROTOCOL_PREFIX = /^(HL error|exchange error|order error)/i

/**
 * Map an unknown error from the SDK or the wallet provider into a short,
 * human-readable string suitable for inline UI display. Strips RPC payloads,
 * stack traces, and provider-specific noise.
 */
export function friendlyError(err: unknown): string {
  if (isUserRejectedError(err)) {
    return 'Transaction rejected in your wallet.'
  }
  if (isBridgeAndSwapError(err)) {
    return friendlyError(err.cause)
  }
  if (err instanceof MissingEvmWalletError) {
    return 'Connect a wallet to continue.'
  }
  if (err instanceof BridgeTimeoutError) {
    return 'Bridge is still settling. Funds are safe; refresh or retry in a moment to continue from HyperCore.'
  }
  if (err instanceof InsufficientBalanceError) {
    return `Insufficient ${err.token}. Add funds and retry.`
  }
  if (err instanceof InvalidInputError) {
    return err.message || 'Invalid input.'
  }
  if (err instanceof NotImplementedError) {
    return err.message || 'Not implemented yet.'
  }
  if (err instanceof SigningError) {
    return 'Wallet signature failed. Please try again.'
  }
  if (err instanceof NetworkError) {
    // Hyperliquid protocol-level rejections are wrapped as NetworkError but
    // their message is actionable for the user (slippage, fees, fills); pass
    // them through. Anything else is RPC/transport noise — redact.
    if (HL_PROTOCOL_PREFIX.test(err.message)) return firstLine(err.message)
    return 'Network error. Please retry.'
  }
  if (err instanceof UsdhKitError) {
    return err.message
  }
  if (err instanceof Error) {
    return firstLine(err.message) || 'Something went wrong.'
  }
  return 'Something went wrong.'
}

function isUserRejectedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  let cursor: unknown = err
  for (let depth = 0; cursor instanceof Error && depth < 4; depth++) {
    if (VIEM_USER_REJECTED_NAMES.has(cursor.name)) return true
    if ('code' in cursor && (cursor as { code?: unknown }).code === 4001) return true
    cursor = (cursor as { cause?: unknown }).cause
  }
  return false
}

function firstLine(message: string): string {
  const idx = message.indexOf('\n')
  return idx === -1 ? message : message.slice(0, idx)
}
