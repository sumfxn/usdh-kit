import { describe, expect, it } from 'vitest'

import {
  BridgeTimeoutError,
  InsufficientBalanceError,
  InvalidInputError,
  MissingEvmWalletError,
  NetworkError,
  SigningError,
  UsdhKitError,
} from '@usdh-kit/sdk'

import { friendlyError } from '../src/friendly-error.js'

class FakeUserRejectedRequestError extends Error {
  constructor() {
    super('User rejected the request.')
    this.name = 'UserRejectedRequestError'
  }
}

describe('friendlyError', () => {
  it('detects viem UserRejectedRequestError by name', () => {
    expect(friendlyError(new FakeUserRejectedRequestError())).toBe(
      'Transaction rejected in your wallet.',
    )
  })

  it('detects EIP-1193 code 4001 user-rejection on the cause chain', () => {
    const inner = Object.assign(new Error('User rejected'), { code: 4001 })
    const outer = new Error('TransactionExecutionError', { cause: inner })
    expect(friendlyError(outer)).toBe('Transaction rejected in your wallet.')
  })

  it('maps MissingEvmWalletError to a connect prompt', () => {
    expect(friendlyError(new MissingEvmWalletError())).toBe('Connect a wallet to continue.')
  })

  it('maps BridgeTimeoutError to a retry prompt that mentions safety', () => {
    const err = new BridgeTimeoutError('0xabcd', 30_000)
    expect(friendlyError(err)).toMatch(/Bridge timed out/i)
    expect(friendlyError(err)).toMatch(/Funds are safe/i)
  })

  it('maps InsufficientBalanceError to an asset-specific prompt', () => {
    const err = new InsufficientBalanceError(1_000n, 500n, 'USDC')
    expect(friendlyError(err)).toBe('Insufficient USDC. Add funds and retry.')
  })

  it('preserves InvalidInputError messages verbatim', () => {
    expect(friendlyError(new InvalidInputError('amount must be positive'))).toBe(
      'amount must be positive',
    )
  })

  it('redacts NetworkError to a generic retry prompt (no RPC payload leakage)', () => {
    expect(friendlyError(new NetworkError('HTTP 502 from https://api.hl/info'))).toBe(
      'Network error. Please retry.',
    )
  })

  it('passes through Hyperliquid protocol-level rejections inside NetworkError', () => {
    expect(
      friendlyError(
        new NetworkError('HL error: Order would immediately match resting order at worse price'),
      ),
    ).toMatch(/Order would immediately match/)
    expect(friendlyError(new NetworkError('exchange error: Insufficient margin'))).toMatch(
      /Insufficient margin/,
    )
  })

  it('maps SigningError to an explicit signature-failed prompt', () => {
    expect(friendlyError(new SigningError('typed data sign failed'))).toBe(
      'Wallet signature failed. Please try again.',
    )
  })

  it('falls back to message first-line for plain Errors', () => {
    expect(friendlyError(new Error('first line\nsecond line\nstack trace'))).toBe('first line')
  })

  it('returns a generic message for unknown values', () => {
    expect(friendlyError('a string')).toBe('Something went wrong.')
    expect(friendlyError(null)).toBe('Something went wrong.')
    expect(friendlyError(undefined)).toBe('Something went wrong.')
  })

  it('uses the UsdhKitError message verbatim for subclasses without a special case', () => {
    class CustomError extends UsdhKitError {
      override readonly name = 'CustomError'
    }
    expect(friendlyError(new CustomError('something specific'))).toBe('something specific')
  })
})
