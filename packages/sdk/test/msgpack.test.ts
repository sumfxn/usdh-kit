import { describe, expect, it } from 'vitest'

import { InvalidInputError } from '../src/errors.js'
import { encode } from '../src/msgpack.js'

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

describe('encode primitives', () => {
  it('null and undefined encode as nil', () => {
    expect(hex(encode(null))).toBe('c0')
    expect(hex(encode(undefined))).toBe('c0')
  })

  it('booleans', () => {
    expect(hex(encode(true))).toBe('c3')
    expect(hex(encode(false))).toBe('c2')
  })

  it('positive fixint (0..127)', () => {
    expect(hex(encode(0))).toBe('00')
    expect(hex(encode(1))).toBe('01')
    expect(hex(encode(127))).toBe('7f')
  })

  it('uint 8 (128..255)', () => {
    expect(hex(encode(128))).toBe('cc80')
    expect(hex(encode(255))).toBe('ccff')
  })

  it('uint 16 (256..65535)', () => {
    expect(hex(encode(256))).toBe('cd0100')
    expect(hex(encode(65535))).toBe('cdffff')
  })

  it('uint 32', () => {
    expect(hex(encode(65536))).toBe('ce00010000')
    expect(hex(encode(4294967295))).toBe('ceffffffff')
  })

  it('uint 64', () => {
    expect(hex(encode(4294967296n))).toBe('cf0000000100000000')
    expect(hex(encode(18446744073709551615n))).toBe('cfffffffffffffffff')
  })

  it('negative fixint (-32..-1)', () => {
    expect(hex(encode(-1))).toBe('ff')
    expect(hex(encode(-32))).toBe('e0')
  })

  it('int 8 (-128..-33)', () => {
    expect(hex(encode(-33))).toBe('d0df')
    expect(hex(encode(-128))).toBe('d080')
  })

  it('int 16', () => {
    expect(hex(encode(-129))).toBe('d1ff7f')
    expect(hex(encode(-32768))).toBe('d18000')
  })

  it('int 32', () => {
    expect(hex(encode(-32769))).toBe('d2ffff7fff')
    expect(hex(encode(-2147483648))).toBe('d280000000')
  })

  it('int 64', () => {
    expect(hex(encode(-2147483649n))).toBe('d3ffffffff7fffffff')
    expect(hex(encode(-9223372036854775808n))).toBe('d38000000000000000')
  })

  it('rejects non-integer numbers', () => {
    expect(() => encode(1.5)).toThrow(InvalidInputError)
    expect(() => encode(Number.NaN)).toThrow(InvalidInputError)
    expect(() => encode(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError)
  })

  it('rejects out-of-range bigints', () => {
    expect(() => encode(1n << 64n)).toThrow(InvalidInputError)
    expect(() => encode(-(1n << 63n) - 1n)).toThrow(InvalidInputError)
  })
})

describe('encode strings', () => {
  it('empty string is fixstr 0', () => {
    expect(hex(encode(''))).toBe('a0')
  })

  it('short fixstr', () => {
    expect(hex(encode('a'))).toBe('a161')
    expect(hex(encode('hello'))).toBe('a568656c6c6f')
  })

  it('fixstr boundary at 31 bytes', () => {
    const s = 'a'.repeat(31)
    const bytes = encode(s)
    expect(bytes[0]).toBe(0xbf) // 0xa0 | 31
    expect(bytes.length).toBe(32)
  })

  it('str 8 (32..255 bytes)', () => {
    const s = 'a'.repeat(32)
    const bytes = encode(s)
    expect(bytes[0]).toBe(0xd9)
    expect(bytes[1]).toBe(0x20)
    expect(bytes.length).toBe(34)
  })

  it('str 16 (256..65535 bytes)', () => {
    const s = 'a'.repeat(256)
    const bytes = encode(s)
    expect(bytes[0]).toBe(0xda)
    expect(bytes[1]).toBe(0x01)
    expect(bytes[2]).toBe(0x00)
    expect(bytes.length).toBe(259)
  })

  it('UTF-8 multibyte characters', () => {
    expect(hex(encode('é'))).toBe('a2c3a9')
    expect(hex(encode('🚀'))).toBe('a4f09f9a80')
  })
})

describe('encode arrays', () => {
  it('empty array is fixarray 0', () => {
    expect(hex(encode([]))).toBe('90')
  })

  it('fixarray', () => {
    expect(hex(encode([1, 2, 3]))).toBe('93010203')
  })

  it('array 16 boundary', () => {
    const arr = Array.from({ length: 16 }, (_, i) => i)
    const bytes = encode(arr)
    expect(bytes[0]).toBe(0xdc)
    expect(bytes[1]).toBe(0x00)
    expect(bytes[2]).toBe(0x10)
  })

  it('mixed-type array', () => {
    expect(hex(encode([true, 'a', 1, null]))).toBe('94c3a16101c0')
  })
})

describe('encode maps', () => {
  it('empty map is fixmap 0', () => {
    expect(hex(encode({}))).toBe('80')
  })

  it('preserves insertion order for string keys', () => {
    expect(hex(encode({ b: 2, a: 1 }))).toBe('82a16202a16101')
  })

  it('drops undefined values', () => {
    expect(hex(encode({ a: 1, b: undefined, c: 2 }))).toBe('82a16101a16302')
  })

  it('keeps null values as nil', () => {
    expect(hex(encode({ a: null }))).toBe('81a161c0')
  })

  it('rejects integer-like string keys', () => {
    expect(() => encode({ '0': 'a', b: 'c' })).toThrow(InvalidInputError)
    expect(() => encode({ '12': 'x' })).toThrow(InvalidInputError)
  })

  it('allows non-integer-like keys that look numeric (e.g. "01", "0a")', () => {
    expect(() => encode({ '01': 1 })).not.toThrow()
    expect(() => encode({ '0a': 1 })).not.toThrow()
  })
})

describe('encode HL order action fixture', () => {
  it('matches the expected byte sequence with insertion-order keys', () => {
    const action = {
      type: 'order',
      orders: [
        {
          a: 0,
          b: true,
          p: '1.0001',
          s: '100',
          r: false,
          t: { limit: { tif: 'Ioc' } },
        },
      ],
      grouping: 'na',
    }
    const expected = [
      '83', // fixmap 3
      'a474797065', // 'type'
      'a56f72646572', // 'order'
      'a66f7264657273', // 'orders'
      '91', // fixarray 1
      '86', // fixmap 6
      'a161', // 'a'
      '00', // 0
      'a162', // 'b'
      'c3', // true
      'a170', // 'p'
      'a6312e30303031', // '1.0001'
      'a173', // 's'
      'a3313030', // '100'
      'a172', // 'r'
      'c2', // false
      'a174', // 't'
      '81', // fixmap 1
      'a56c696d6974', // 'limit'
      '81', // fixmap 1
      'a3746966', // 'tif'
      'a3496f63', // 'Ioc'
      'a867726f7570696e67', // 'grouping'
      'a26e61', // 'na'
    ].join('')
    expect(hex(encode(action))).toBe(expected)
  })
})

describe('rejects unsupported types', () => {
  it('Date', () => {
    expect(() => encode(new Date())).toThrow(InvalidInputError)
  })

  it('Map', () => {
    expect(() => encode(new Map())).toThrow(InvalidInputError)
  })

  it('Set', () => {
    expect(() => encode(new Set())).toThrow(InvalidInputError)
  })

  it('Function', () => {
    expect(() => encode(() => 0)).toThrow(InvalidInputError)
  })

  it('Symbol', () => {
    expect(() => encode(Symbol('x'))).toThrow(InvalidInputError)
  })
})
