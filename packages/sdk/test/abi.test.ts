import { describe, expect, it } from 'vitest'

import {
  APPROVE_SELECTOR,
  CORE_DEPOSIT_SELECTOR,
  TRANSFER_SELECTOR,
  encodeCoreDeposit,
  encodeErc20Approve,
  encodeErc20Transfer,
} from '../src/abi.js'
import { InvalidInputError } from '../src/errors.js'

describe('TRANSFER_SELECTOR', () => {
  it('is the canonical keccak256 4-byte selector for transfer(address,uint256)', () => {
    expect(TRANSFER_SELECTOR).toBe('0xa9059cbb')
  })
})

describe('APPROVE_SELECTOR', () => {
  it('is the canonical keccak256 4-byte selector for approve(address,uint256)', () => {
    expect(APPROVE_SELECTOR).toBe('0x095ea7b3')
  })
})

describe('CORE_DEPOSIT_SELECTOR', () => {
  it('is the canonical keccak256 4-byte selector for deposit(uint256,uint32)', () => {
    expect(CORE_DEPOSIT_SELECTOR).toBe('0x2b2dfd2c')
  })
})

describe('encodeErc20Transfer', () => {
  it('encodes selector + 32-byte padded address + 32-byte amount', () => {
    const out = encodeErc20Transfer('0x2000000000000000000000000000000000000000', 1_000_000n)
    expect(out).toBe(
      [
        '0xa9059cbb',
        '000000000000000000000000', // 12-byte left pad
        '2000000000000000000000000000000000000000', // address
        '00000000000000000000000000000000000000000000000000000000000f4240', // 1_000_000
      ].join(''),
    )
  })

  it('handles a non-system recipient and a small amount', () => {
    const out = encodeErc20Transfer('0x111111a1a0667d36bd57c0a9f569b98057111111', 0n)
    expect(out).toBe(
      [
        '0xa9059cbb',
        '000000000000000000000000',
        '111111a1a0667d36bd57c0a9f569b98057111111',
        '0000000000000000000000000000000000000000000000000000000000000000',
      ].join(''),
    )
  })

  it('encodes uint256-max amounts', () => {
    const max = (1n << 256n) - 1n
    const out = encodeErc20Transfer('0x2000000000000000000000000000000000000000', max)
    expect(out.endsWith('f'.repeat(64))).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(() => encodeErc20Transfer('0x123' as `0x${string}`, 1n)).toThrow(InvalidInputError)
    expect(() => encodeErc20Transfer('not-hex' as `0x${string}`, 1n)).toThrow(InvalidInputError)
  })

  it('rejects negative amounts', () => {
    expect(() => encodeErc20Transfer('0x2000000000000000000000000000000000000000', -1n)).toThrow(
      InvalidInputError,
    )
  })
})

describe('encodeErc20Approve', () => {
  it('encodes selector + spender + amount', () => {
    const out = encodeErc20Approve('0x6b9e773128f453f5c2c60935ee2de2cbc5390a24', 1_000_000n)
    expect(out).toBe(
      [
        '0x095ea7b3',
        '000000000000000000000000',
        '6b9e773128f453f5c2c60935ee2de2cbc5390a24',
        '00000000000000000000000000000000000000000000000000000000000f4240',
      ].join(''),
    )
  })
})

describe('encodeCoreDeposit', () => {
  it('encodes amount + spot dex id', () => {
    const out = encodeCoreDeposit(1_000_000n, 0xffffffff)
    expect(out).toBe(
      [
        '0x2b2dfd2c',
        '00000000000000000000000000000000000000000000000000000000000f4240',
        '00000000000000000000000000000000000000000000000000000000ffffffff',
      ].join(''),
    )
  })

  it('rejects invalid destination dex ids', () => {
    expect(() => encodeCoreDeposit(1n, -1)).toThrow(InvalidInputError)
    expect(() => encodeCoreDeposit(1n, 0x1_0000_0000)).toThrow(InvalidInputError)
  })
})
