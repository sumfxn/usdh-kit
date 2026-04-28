import { describe, expect, it } from 'vitest'

import { bigintToBytesBE, bytesToHex, concatBytes, hexToBytes } from '../src/bytes.js'
import { InvalidInputError } from '../src/errors.js'

describe('hexToBytes', () => {
  it('decodes hex strings', () => {
    expect(hexToBytes('0x00')).toEqual(new Uint8Array([0]))
    expect(hexToBytes('0xff')).toEqual(new Uint8Array([255]))
    expect(hexToBytes('0xdeadbeef')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('rejects malformed hex', () => {
    expect(() => hexToBytes('00')).toThrow(InvalidInputError)
    expect(() => hexToBytes('0xZZ')).toThrow(InvalidInputError)
    expect(() => hexToBytes('0x0')).toThrow(InvalidInputError)
    expect(() => hexToBytes('')).toThrow(InvalidInputError)
  })
})

describe('bytesToHex', () => {
  it('encodes byte arrays', () => {
    expect(bytesToHex(new Uint8Array([0]))).toBe('0x00')
    expect(bytesToHex(new Uint8Array([0xde, 0xad]))).toBe('0xdead')
    expect(bytesToHex(new Uint8Array())).toBe('0x')
  })
})

describe('bigintToBytesBE', () => {
  it('encodes uint64 big-endian', () => {
    expect(bigintToBytesBE(0n, 8)).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]))
    expect(bigintToBytesBE(1n, 8)).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]))
    expect(bigintToBytesBE(0xffn, 8)).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0xff]))
    expect(bigintToBytesBE(0x0102030405060708n, 8)).toEqual(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    )
  })

  it('rejects negative values', () => {
    expect(() => bigintToBytesBE(-1n, 8)).toThrow(InvalidInputError)
  })

  it('rejects values that overflow the buffer', () => {
    expect(() => bigintToBytesBE(1n << 64n, 8)).toThrow(InvalidInputError)
  })
})

describe('concatBytes', () => {
  it('concatenates multiple byte arrays', () => {
    const a = new Uint8Array([1, 2])
    const b = new Uint8Array([3])
    const c = new Uint8Array([4, 5, 6])
    expect(concatBytes(a, b, c)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]))
  })

  it('handles empty arrays', () => {
    expect(concatBytes()).toEqual(new Uint8Array())
    expect(concatBytes(new Uint8Array(), new Uint8Array([1]))).toEqual(new Uint8Array([1]))
  })
})
