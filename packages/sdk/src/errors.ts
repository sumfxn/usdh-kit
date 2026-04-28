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

/** `bridgeToCore` was called without an `evmWallet` configured. */
export class MissingEvmWalletError extends UsdhKitError {
  override readonly name = 'MissingEvmWalletError'

  constructor() {
    super('bridgeToCore requires KitConfig.evmWallet')
  }
}

/**
 * The HyperEVM transfer landed but HyperCore did not credit the deposit
 * within the configured window. The bridge is async on the HC side; the
 * caller can retry the credit poll without re-sending the transfer.
 */
export class BridgeTimeoutError extends UsdhKitError {
  override readonly name = 'BridgeTimeoutError'

  constructor(
    public readonly txHash: `0x${string}`,
    public readonly timeoutMs: number,
  ) {
    super(`HyperCore did not credit bridge deposit within ${timeoutMs}ms (tx ${txHash})`)
  }
}
