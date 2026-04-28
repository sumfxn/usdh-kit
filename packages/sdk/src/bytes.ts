import { InvalidInputError } from './errors.js'
import type { Hex } from './types/hex.js'

const HEX_PATTERN = /^0x[0-9a-fA-F]+$/

export function hexToBytes(hex: string): Uint8Array {
  if (!HEX_PATTERN.test(hex)) {
    throw new InvalidInputError(`invalid hex: ${hex}`)
  }
  const stripped = hex.slice(2)
  if (stripped.length % 2 !== 0) {
    throw new InvalidInputError('hex must have an even number of characters')
  }
  const out = new Uint8Array(stripped.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(stripped.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function bytesToHex(bytes: Uint8Array): Hex {
  let s = '0x'
  for (const b of bytes) {
    s += b.toString(16).padStart(2, '0')
  }
  return s as Hex
}

export function bigintToBytesBE(value: bigint, len: number): Uint8Array {
  if (value < 0n) {
    throw new InvalidInputError('bigintToBytesBE requires a non-negative value')
  }
  const out = new Uint8Array(len)
  let remaining = value
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
  if (remaining !== 0n) {
    throw new InvalidInputError(`value does not fit in ${len} bytes`)
  }
  return out
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let total = 0
  for (const a of arrays) total += a.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}
