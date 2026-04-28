import { InvalidInputError } from './errors.js'

/**
 * Encode a value into Hyperliquid-compatible msgpack bytes.
 *
 * Supports: null, boolean, integer numbers, bigint, string, array, map
 * (plain object with string keys). Maps preserve insertion order, which
 * HL signing requires.
 *
 * Caveats:
 * - `undefined` map values are dropped (matches Python "field absent").
 * - `null` is encoded as nil (0xc0); for "field absent" semantics, omit
 *   the key or pass `undefined`.
 * - Integer-like string keys (e.g. "0", "1") throw, because V8 reorders
 *   them ahead of non-integer keys and would break HL signature parity.
 *
 * Floats, binary blobs, and ext types are intentionally unsupported.
 */
export function encode(value: unknown): Uint8Array {
  const w = new Writer()
  writeValue(value, w)
  return w.toBytes()
}

class Writer {
  private chunks: Uint8Array[] = []
  private size = 0

  byte(b: number): void {
    this.push(Uint8Array.of(b & 0xff))
  }

  push(bytes: Uint8Array): void {
    this.chunks.push(bytes)
    this.size += bytes.length
  }

  toBytes(): Uint8Array {
    const out = new Uint8Array(this.size)
    let offset = 0
    for (const chunk of this.chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }
}

function writeValue(v: unknown, w: Writer): void {
  if (v === null || v === undefined) {
    w.byte(0xc0)
    return
  }
  switch (typeof v) {
    case 'boolean':
      w.byte(v ? 0xc3 : 0xc2)
      return
    case 'number':
      if (!Number.isInteger(v)) {
        throw new InvalidInputError('msgpack: only integer numbers supported')
      }
      writeInt(BigInt(v), w)
      return
    case 'bigint':
      writeInt(v, w)
      return
    case 'string':
      writeString(v, w)
      return
    case 'object':
      if (Array.isArray(v)) {
        writeArray(v, w)
        return
      }
      if (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null) {
        writeMap(v as Record<string, unknown>, w)
        return
      }
      throw new InvalidInputError(
        `msgpack: unsupported object type ${(v as object).constructor?.name ?? 'unknown'}`,
      )
    default:
      throw new InvalidInputError(`msgpack: unsupported type ${typeof v}`)
  }
}

const I64_MIN = -(1n << 63n)
const I64_MAX = (1n << 63n) - 1n
const U64_MAX = (1n << 64n) - 1n

function writeInt(n: bigint, w: Writer): void {
  if (n > U64_MAX || n < I64_MIN) {
    throw new InvalidInputError(`msgpack: integer out of 64-bit range: ${n}`)
  }
  if (n >= 0n) {
    if (n <= 0x7fn) {
      w.byte(Number(n))
    } else if (n <= 0xffn) {
      w.byte(0xcc)
      w.byte(Number(n))
    } else if (n <= 0xffffn) {
      w.byte(0xcd)
      writeBigEndian(n, 2, w)
    } else if (n <= 0xffffffffn) {
      w.byte(0xce)
      writeBigEndian(n, 4, w)
    } else {
      w.byte(0xcf)
      writeBigEndian(n, 8, w)
    }
    return
  }
  // negative
  if (n >= -32n) {
    w.byte(Number(n) & 0xff)
  } else if (n >= -0x80n) {
    w.byte(0xd0)
    w.byte(Number(n) & 0xff)
  } else if (n >= -0x8000n) {
    w.byte(0xd1)
    writeBigEndian(n & 0xffffn, 2, w)
  } else if (n >= -0x80000000n) {
    w.byte(0xd2)
    writeBigEndian(n & 0xffffffffn, 4, w)
  } else if (n >= I64_MIN && n <= I64_MAX) {
    w.byte(0xd3)
    writeBigEndian(n & U64_MAX, 8, w)
  } else {
    throw new InvalidInputError(`msgpack: integer out of 64-bit range: ${n}`)
  }
}

function writeBigEndian(n: bigint, bytes: number, w: Writer): void {
  for (let i = bytes - 1; i >= 0; i--) {
    w.byte(Number((n >> BigInt(i * 8)) & 0xffn))
  }
}

function writeString(s: string, w: Writer): void {
  const bytes = new TextEncoder().encode(s)
  const len = bytes.length
  if (len <= 31) {
    w.byte(0xa0 | len)
  } else if (len <= 0xff) {
    w.byte(0xd9)
    w.byte(len)
  } else if (len <= 0xffff) {
    w.byte(0xda)
    writeBigEndian(BigInt(len), 2, w)
  } else if (len <= 0xffffffff) {
    w.byte(0xdb)
    writeBigEndian(BigInt(len), 4, w)
  } else {
    throw new InvalidInputError(`msgpack: string too long (${len} bytes)`)
  }
  w.push(bytes)
}

function writeArray(arr: unknown[], w: Writer): void {
  const len = arr.length
  if (len <= 15) {
    w.byte(0x90 | len)
  } else if (len <= 0xffff) {
    w.byte(0xdc)
    writeBigEndian(BigInt(len), 2, w)
  } else if (len <= 0xffffffff) {
    w.byte(0xdd)
    writeBigEndian(BigInt(len), 4, w)
  } else {
    throw new InvalidInputError(`msgpack: array too long (${len} entries)`)
  }
  for (const item of arr) {
    writeValue(item, w)
  }
}

const INTEGER_LIKE_KEY = /^(0|[1-9]\d*)$/

function writeMap(obj: Record<string, unknown>, w: Writer): void {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined)
  for (const key of keys) {
    if (INTEGER_LIKE_KEY.test(key)) {
      throw new InvalidInputError(
        `msgpack: integer-like string key "${key}" breaks insertion order, use an array`,
      )
    }
  }
  const len = keys.length
  if (len <= 15) {
    w.byte(0x80 | len)
  } else if (len <= 0xffff) {
    w.byte(0xde)
    writeBigEndian(BigInt(len), 2, w)
  } else if (len <= 0xffffffff) {
    w.byte(0xdf)
    writeBigEndian(BigInt(len), 4, w)
  } else {
    throw new InvalidInputError(`msgpack: map too large (${len} entries)`)
  }
  for (const key of keys) {
    writeString(key, w)
    writeValue(obj[key], w)
  }
}
