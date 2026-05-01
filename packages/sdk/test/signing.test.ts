import { keccak_256 } from '@noble/hashes/sha3'
import { describe, expect, it, vi } from 'vitest'

import { bigintToBytesBE, bytesToHex, concatBytes } from '../src/bytes.js'
import { SigningError } from '../src/errors.js'
import { encode as msgpackEncode } from '../src/msgpack.js'
import { computeActionHash, parseSignature, signL1Action } from '../src/signing.js'
import type { Signer } from '../src/types/signer.js'

const stubSigner: Signer = {
  address: '0x0000000000000000000000000000000000000001',
  signTypedData: async () => '0x' as `0x${string}`,
  signMessage: async () => '0x' as `0x${string}`,
}

const orderAction = {
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

describe('computeActionHash', () => {
  it('hashes msgpack(action) || nonce_be8 || 0x00 when no vault', () => {
    const nonce = 1735300000000n
    const expected = bytesToHex(
      keccak_256(
        concatBytes(msgpackEncode(orderAction), bigintToBytesBE(nonce, 8), Uint8Array.of(0x00)),
      ),
    )
    expect(computeActionHash(orderAction, nonce)).toBe(expected)
  })

  it('appends 0x01 + 20-byte vault address when provided', () => {
    const nonce = 42n
    const vault = '0x000000000000000000000000000000000000abcd'
    const addr = new Uint8Array(20)
    addr[18] = 0xab
    addr[19] = 0xcd
    const expected = bytesToHex(
      keccak_256(
        concatBytes(
          msgpackEncode(orderAction),
          bigintToBytesBE(nonce, 8),
          Uint8Array.of(0x01),
          addr,
        ),
      ),
    )
    expect(computeActionHash(orderAction, nonce, vault)).toBe(expected)
  })

  it('accepts a checksummed vault address (lowercases internally)', () => {
    const lower = '0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd'
    const checksummed = '0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD'
    expect(computeActionHash(orderAction, 1n, checksummed)).toBe(
      computeActionHash(orderAction, 1n, lower),
    )
  })

  it('rejects a non-20-byte vault address', () => {
    expect(() => computeActionHash(orderAction, 1n, '0x1234')).toThrow(SigningError)
  })

  it('appends expiresAfter when provided', () => {
    const nonce = 1735300000000n
    const expiresAfter = nonce + 30_000n
    const expected = bytesToHex(
      keccak_256(
        concatBytes(
          msgpackEncode(orderAction),
          bigintToBytesBE(nonce, 8),
          Uint8Array.of(0x00),
          Uint8Array.of(0x00),
          bigintToBytesBE(expiresAfter, 8),
        ),
      ),
    )
    expect(computeActionHash(orderAction, nonce, undefined, expiresAfter)).toBe(expected)
  })
})

describe('parseSignature', () => {
  const sample =
    '0xc0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0' +
    'b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0' +
    '1b'

  it('splits a 65-byte hex into r/s/v', () => {
    expect(parseSignature(sample)).toEqual({
      r: '0xc0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0',
      s: '0xb0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0',
      v: 27,
    })
  })

  it('normalises v from 0/1 to 27/28', () => {
    const lowV =
      '0xc0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0' +
      'b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0' +
      '00'
    expect(parseSignature(lowV).v).toBe(27)
  })

  it('accepts hex without 0x prefix', () => {
    const noPrefix = sample.slice(2)
    expect(parseSignature(noPrefix).v).toBe(27)
  })

  it('rejects a wrong-length signature', () => {
    expect(() => parseSignature('0x1234')).toThrow(SigningError)
  })

  it('rejects a non-canonical recovery byte', () => {
    const bogus = `0x${'a'.repeat(64)}${'b'.repeat(64)}ff`
    expect(() => parseSignature(bogus)).toThrow(SigningError)
  })
})

describe('signL1Action', () => {
  it('passes the phantom-agent typed data to the signer with mainnet source "a"', async () => {
    const signTypedData = vi.fn(
      async () => `0x${'1'.repeat(64)}${'2'.repeat(64)}1c` as `0x${string}`,
    )
    const signer: Signer = { ...stubSigner, signTypedData }
    await signL1Action({
      signer,
      action: orderAction,
      nonce: 1n,
      network: 'mainnet',
    })
    expect(signTypedData).toHaveBeenCalledOnce()
    const args = signTypedData.mock.calls[0]?.[0]
    expect(args?.domain).toEqual({
      name: 'Exchange',
      version: '1',
      chainId: 1337,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    })
    expect(args?.primaryType).toBe('Agent')
    expect(args?.message.source).toBe('a')
    expect(args?.message.connectionId).toBe(computeActionHash(orderAction, 1n))
  })

  it('uses source "b" on testnet', async () => {
    const signTypedData = vi.fn(
      async () => `0x${'2'.repeat(64)}${'3'.repeat(64)}1b` as `0x${string}`,
    )
    const signer: Signer = { ...stubSigner, signTypedData }
    await signL1Action({
      signer,
      action: orderAction,
      nonce: 1n,
      network: 'testnet',
    })
    const args = signTypedData.mock.calls[0]?.[0]
    expect(args?.message.source).toBe('b')
  })

  it('commits expiresAfter into the signed connectionId', async () => {
    const signTypedData = vi.fn(
      async () => `0x${'2'.repeat(64)}${'3'.repeat(64)}1b` as `0x${string}`,
    )
    const signer: Signer = { ...stubSigner, signTypedData }
    await signL1Action({
      signer,
      action: orderAction,
      nonce: 1n,
      expiresAfter: 31_000n,
      network: 'testnet',
    })
    const args = signTypedData.mock.calls[0]?.[0]
    expect(args?.message.connectionId).toBe(computeActionHash(orderAction, 1n, undefined, 31_000n))
  })

  it('returns r/s/v parsed from the signer output', async () => {
    const signTypedData = vi.fn(
      async () => `0x${'a'.repeat(64)}${'b'.repeat(64)}1c` as `0x${string}`,
    )
    const signer: Signer = { ...stubSigner, signTypedData }
    const sig = await signL1Action({
      signer,
      action: orderAction,
      nonce: 1n,
      network: 'mainnet',
    })
    expect(sig).toEqual({
      r: `0x${'a'.repeat(64)}`,
      s: `0x${'b'.repeat(64)}`,
      v: 28,
    })
  })

  it('wraps signer rejections in SigningError', async () => {
    const signer: Signer = {
      ...stubSigner,
      signTypedData: async () => {
        throw new Error('user rejected')
      },
    }
    await expect(
      signL1Action({ signer, action: orderAction, nonce: 1n, network: 'mainnet' }),
    ).rejects.toBeInstanceOf(SigningError)
  })
})
