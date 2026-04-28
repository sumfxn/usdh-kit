import { describe, expect, it } from 'vitest'

import { InvalidInputError, NotImplementedError, type Signer, createUsdhKit } from '../src/index.js'

const stubSigner: Signer = {
  address: '0x0000000000000000000000000000000000000001',
  signTypedData: async () => '0x' as const,
  signMessage: async () => '0x' as const,
}

describe('createUsdhKit', () => {
  it('binds the configured network', () => {
    const kit = createUsdhKit({ network: 'testnet', signer: stubSigner })
    expect(kit.network).toBe('testnet')
  })

  it('rejects an invalid network', () => {
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
      createUsdhKit({ network: 'devnet' as any, signer: stubSigner }),
    ).toThrow(InvalidInputError)
  })

  it('rejects a missing signer', () => {
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
      createUsdhKit({ network: 'mainnet', signer: undefined as any }),
    ).toThrow(InvalidInputError)
  })

  it('rejects out-of-range slippage', () => {
    expect(() =>
      createUsdhKit({ network: 'mainnet', signer: stubSigner, slippageBps: -1 }),
    ).toThrow(InvalidInputError)
    expect(() =>
      createUsdhKit({ network: 'mainnet', signer: stubSigner, slippageBps: 10_001 }),
    ).toThrow(InvalidInputError)
  })
})

describe('swap', () => {
  const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner })

  it('validates the source stable', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: deliberately bad input
    await expect(kit.swap({ from: 'DAI' as any, amount: 1n })).rejects.toThrow(InvalidInputError)
  })

  it('validates the amount', async () => {
    await expect(kit.swap({ from: 'USDC', amount: 0n })).rejects.toThrow(InvalidInputError)
  })

  it('throws NotImplementedError for valid input', async () => {
    await expect(kit.swap({ from: 'USDC', amount: 1_000_000n })).rejects.toThrow(
      NotImplementedError,
    )
  })
})

describe('getQuote', () => {
  const kit = createUsdhKit({ network: 'mainnet', signer: stubSigner })

  it('throws NotImplementedError for valid input', async () => {
    await expect(kit.getQuote({ from: 'USDT', amount: 1_000_000n })).rejects.toThrow(
      NotImplementedError,
    )
  })
})
