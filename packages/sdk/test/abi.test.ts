import { describe, expect, it } from 'vitest'

import { TRANSFER_SELECTOR, encodeErc20Transfer } from '../src/abi.js'
import { InvalidInputError } from '../src/errors.js'

describe('TRANSFER_SELECTOR', () => {
  it('is the canonical keccak256 4-byte selector for transfer(address,uint256)', () => {
    expect(TRANSFER_SELECTOR).toBe('0xa9059cbb')
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
