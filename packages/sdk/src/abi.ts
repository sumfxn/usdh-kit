import { bigintToBytesBE, bytesToHex, concatBytes, hexToBytes } from './bytes.js'
import { InvalidInputError } from './errors.js'
import type { Address, Hex } from './types/hex.js'

/** Function selector for `transfer(address,uint256)` (first 4 bytes of keccak256). */
export const TRANSFER_SELECTOR: Hex = '0xa9059cbb'
/** Function selector for `approve(address,uint256)` (first 4 bytes of keccak256). */
export const APPROVE_SELECTOR: Hex = '0x095ea7b3'
/** Function selector for `deposit(uint256,uint32)` on Circle's CoreDepositWallet. */
export const CORE_DEPOSIT_SELECTOR: Hex = '0x2b2dfd2c'

const ADDRESS_HEX_LENGTH = 42

/**
 * Encode an ERC20 `transfer(to, amount)` call.
 *
 * Layout: 4-byte selector || 32-byte left-padded `to` || 32-byte big-endian `amount`.
 * Pure-TS, no viem dep — matches the canonical Solidity ABI for two static args.
 */
export function encodeErc20Transfer(to: Address, amount: bigint): Hex {
  return encodeAddressUint256Call(TRANSFER_SELECTOR, to, amount)
}

/** Encode an ERC20 `approve(spender, amount)` call. */
export function encodeErc20Approve(spender: Address, amount: bigint): Hex {
  return encodeAddressUint256Call(APPROVE_SELECTOR, spender, amount)
}

/** Encode Circle CoreDepositWallet `deposit(amount, destinationDex)` call. */
export function encodeCoreDeposit(amount: bigint, destinationDex: number): Hex {
  if (amount < 0n) {
    throw new InvalidInputError('amount must be non-negative')
  }
  if (!Number.isInteger(destinationDex) || destinationDex < 0 || destinationDex > 0xffffffff) {
    throw new InvalidInputError(`destinationDex must be a uint32, got ${destinationDex}`)
  }
  const selector = hexToBytes(CORE_DEPOSIT_SELECTOR)
  const amountPadded = bigintToBytesBE(amount, 32)
  const destinationPadded = bigintToBytesBE(BigInt(destinationDex), 32)
  return bytesToHex(concatBytes(selector, amountPadded, destinationPadded))
}

function encodeAddressUint256Call(selectorHex: Hex, address: Address, amount: bigint): Hex {
  if (
    typeof address !== 'string' ||
    !address.startsWith('0x') ||
    address.length !== ADDRESS_HEX_LENGTH
  ) {
    throw new InvalidInputError(`invalid address: ${address}`)
  }
  if (amount < 0n) {
    throw new InvalidInputError('amount must be non-negative')
  }
  const selector = hexToBytes(selectorHex)
  const addrBytes = hexToBytes(address)
  const addrPadded = new Uint8Array(32)
  addrPadded.set(addrBytes, 12)
  const amountPadded = bigintToBytesBE(amount, 32)
  return bytesToHex(concatBytes(selector, addrPadded, amountPadded))
}
