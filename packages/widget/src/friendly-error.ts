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
  if (isBridgeAndSwapError(err)) {
    return friendlyError(err.cause)
  }
  if (err instanceof SigningError) {
    if (isUserRejectedError(getErrorCause(err))) {
      return 'Signature rejected in wallet.'
    }
    if (isTypedDataSigningFailure(err)) {
      return 'Wallet could not sign the Hyperliquid order. Check wallet EIP-712 signing support and retry.'
    }
    return 'Wallet signature failed. Please try again.'
  }
  if (isUserRejectedError(err)) {
    return 'Transaction rejected in your wallet.'
  }
  if (err instanceof MissingEvmWalletError) {
    return 'Connect a wallet to continue.'
  }
  if (err instanceof BridgeTimeoutError) {
    return 'Bridge timed out before HyperCore credited the deposit. Funds are safe; retry to keep waiting.'
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
  let cursor: unknown = err
  for (let depth = 0; isObjectLike(cursor) && depth < 4; depth++) {
    const shape = cursor as { name?: unknown; code?: unknown; cause?: unknown }
    if (typeof shape.name === 'string' && VIEM_USER_REJECTED_NAMES.has(shape.name)) return true
    if (shape.code === 4001) return true
    cursor = shape.cause
  }
  return false
}

function isTypedDataSigningFailure(err: unknown): boolean {
  const message = errorChainText(err).toLowerCase()
  return (
    message.includes('signtypeddata') ||
    message.includes('typed data') ||
    message.includes('eip-712') ||
    message.includes('eip712') ||
    message.includes('chainid')
  )
}

function errorChainText(err: unknown): string {
  const parts: string[] = []
  let cursor: unknown = err
  for (let depth = 0; isObjectLike(cursor) && depth < 4; depth++) {
    const shape = cursor as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown }
    if (typeof shape.name === 'string') parts.push(shape.name)
    if (typeof shape.code === 'string' || typeof shape.code === 'number')
      parts.push(String(shape.code))
    if (typeof shape.message === 'string') parts.push(shape.message)
    cursor = shape.cause
  }
  return parts.join(' ')
}

function getErrorCause(err: unknown): unknown {
  if (!isObjectLike(err)) return undefined
  return (err as { cause?: unknown }).cause
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
}

function firstLine(message: string): string {
  const idx = message.indexOf('\n')
  return idx === -1 ? message : message.slice(0, idx)
}
