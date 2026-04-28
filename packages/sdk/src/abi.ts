import { bigintToBytesBE, bytesToHex, concatBytes, hexToBytes } from './bytes.js'
import { InvalidInputError } from './errors.js'
import type { Address, Hex } from './types/hex.js'

/** Function selector for `transfer(address,uint256)` (first 4 bytes of keccak256). */
export const TRANSFER_SELECTOR: Hex = '0xa9059cbb'

const ADDRESS_HEX_LENGTH = 42

/**
 * Encode an ERC20 `transfer(to, amount)` call.
 *
 * Layout: 4-byte selector || 32-byte left-padded `to` || 32-byte big-endian `amount`.
 * Pure-TS, no viem dep — matches the canonical Solidity ABI for two static args.
 */
export function encodeErc20Transfer(to: Address, amount: bigint): Hex {
  if (typeof to !== 'string' || !to.startsWith('0x') || to.length !== ADDRESS_HEX_LENGTH) {
    throw new InvalidInputError(`invalid recipient address: ${to}`)
  }
  if (amount < 0n) {
    throw new InvalidInputError('amount must be non-negative')
  }
  const selector = hexToBytes(TRANSFER_SELECTOR)
  const addrBytes = hexToBytes(to)
  const addrPadded = new Uint8Array(32)
  addrPadded.set(addrBytes, 12)
  const amountPadded = bigintToBytesBE(amount, 32)
  return bytesToHex(concatBytes(selector, addrPadded, amountPadded))
}
