/** Base class for all errors thrown by usdh-kit. */
export class UsdhKitError extends Error {
  override readonly name: string = 'UsdhKitError'
}

/** Invalid arguments passed to the SDK. */
export class InvalidInputError extends UsdhKitError {
  override readonly name = 'InvalidInputError'
}

/** Account does not hold enough of the source token. */
export class InsufficientBalanceError extends UsdhKitError {
  override readonly name = 'InsufficientBalanceError'

  constructor(
    public readonly required: bigint,
    public readonly available: bigint,
    public readonly token: string,
  ) {
    super(`Insufficient ${token}: required ${required}, available ${available}`)
  }
}

/** Realised slippage exceeded tolerance. The order is canceled. */
export class SlippageExceededError extends UsdhKitError {
  override readonly name = 'SlippageExceededError'

  constructor(
    public readonly toleranceBps: number,
    public readonly observedBps: number,
  ) {
    super(`Slippage ${observedBps}bps exceeded tolerance ${toleranceBps}bps`)
  }
}

/** HTTP or websocket transport error. */
export class NetworkError extends UsdhKitError {
  override readonly name = 'NetworkError'

  constructor(
    message: string,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

/** Signer rejected or failed to sign. */
export class SigningError extends UsdhKitError {
  override readonly name = 'SigningError'
}

/** Used by stubs in PR #2. Replaced by real impl in follow-ups. */
export class NotImplementedError extends UsdhKitError {
  override readonly name = 'NotImplementedError'
}
