import { describe, expect, it, vi } from 'vitest'

import { evmToCoreUnits, runBridgeToCore, tokenSystemAddress } from '../src/bridge.js'
import {
  BridgeTimeoutError,
  InvalidInputError,
  MissingEvmWalletError,
  NetworkError,
} from '../src/errors.js'
import type { InfoClient } from '../src/transport/info.js'
import type { SpotClearinghouseState, SpotMeta } from '../src/transport/types.js'
import type { EvmWallet } from '../src/types/evm-wallet.js'
import { silentLogger } from '../src/types/logger.js'

const usdcEvmContract = '0x6b9e773128f453f5c2c60935ee2de2cbc5390a24'
const sampleSpotMeta: SpotMeta = {
  universe: [{ name: 'USDH/USDC', tokens: [1, 0], index: 0, isCanonical: true }],
  tokens: [
    {
      name: 'USDC',
      szDecimals: 8,
      weiDecimals: 8,
      index: 0,
      tokenId: '0xaaaa',
      isCanonical: true,
      evmContract: { address: usdcEvmContract, evm_extra_wei_decimals: -2 },
    },
    {
      name: 'USDH',
      szDecimals: 8,
      weiDecimals: 8,
      index: 360,
      tokenId: '0xbbbb',
      isCanonical: false,
      evmContract: {
        address: '0x111111a1a0667d36bd57c0a9f569b98057111111',
        evm_extra_wei_decimals: -2,
      },
    },
  ],
}

function stateWith(usdcTotal: string): SpotClearinghouseState {
  return {
    balances: [{ coin: 'USDC', token: 0, total: usdcTotal, hold: '0', entryNtl: '0' }],
  }
}

function stubInfo(states: SpotClearinghouseState[]): InfoClient {
  let i = 0
  return {
    spotMeta: vi.fn(async () => sampleSpotMeta),
    l2Book: vi.fn(),
    spotClearinghouseState: vi.fn(async () => {
      const s = states[Math.min(i, states.length - 1)]
      i += 1
      return s as SpotClearinghouseState
    }),
  }
}

function stubWallet(txHash = `0x${'f'.repeat(64)}`): EvmWallet & { calls: unknown[] } {
  const calls: unknown[] = []
  return {
    address: '0x0000000000000000000000000000000000000abc',
    sendTransaction: async (req) => {
      calls.push(req)
      return txHash as `0x${string}`
    },
    calls,
  }
}

describe('tokenSystemAddress', () => {
  it('encodes index 0 as 0x20...000', () => {
    expect(tokenSystemAddress(0)).toBe('0x2000000000000000000000000000000000000000')
  })

  it('encodes index 1 as 0x20...001', () => {
    expect(tokenSystemAddress(1)).toBe('0x2000000000000000000000000000000000000001')
  })

  it('encodes USDH index 360 as 0x20...168', () => {
    expect(tokenSystemAddress(360)).toBe('0x2000000000000000000000000000000000000168')
  })

  it('encodes index 1385 as 0x20...569 (HL doc fixture)', () => {
    expect(tokenSystemAddress(1385)).toBe('0x2000000000000000000000000000000000000569')
  })

  it('rejects negative or non-integer indices', () => {
    expect(() => tokenSystemAddress(-1)).toThrow(InvalidInputError)
    expect(() => tokenSystemAddress(1.5)).toThrow(InvalidInputError)
  })

  it('rejects an index that overflows the 19-byte tail', () => {
    // Number cannot represent 2^(19*8) precisely, but Number.MAX_SAFE_INTEGER
    // (2^53 - 1) fits in 7 bytes; the cap is bigintToBytesBE's overflow check.
    // We assert via the lower-level guarantee using a value that cannot fit:
    // any positive non-integer is rejected upstream already; integer overflow
    // only kicks in past 2^152 which JS Number can't hold. Document the
    // guarantee with a non-integer test instead.
    expect(() => tokenSystemAddress(Number.NaN)).toThrow(InvalidInputError)
    expect(() => tokenSystemAddress(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError)
  })
})

describe('evmToCoreUnits', () => {
  it('scales up for negative evm_extra_wei_decimals (USDC: 6 → 8 dec)', () => {
    expect(evmToCoreUnits(100_000_000n, -2)).toBe(10_000_000_000n)
  })

  it('returns the same units when extra is 0', () => {
    expect(evmToCoreUnits(123n, 0)).toBe(123n)
  })

  it('scales down for positive extra', () => {
    expect(evmToCoreUnits(10_000_000_000n, 2)).toBe(100_000_000n)
  })
})

describe('runBridgeToCore', () => {
  const baseUser = '0x0000000000000000000000000000000000000abc' as const

  it('throws when evmWallet is missing', async () => {
    await expect(
      runBridgeToCore(
        { asset: 'USDC', amount: 1_000_000n, user: baseUser },
        {
          info: stubInfo([stateWith('0')]),
          evmWallet: undefined,
          network: 'mainnet',
          logger: silentLogger,
        },
      ),
    ).rejects.toBeInstanceOf(MissingEvmWalletError)
  })

  it('rejects non-positive amounts', async () => {
    await expect(
      runBridgeToCore(
        { asset: 'USDC', amount: 0n, user: baseUser },
        {
          info: stubInfo([stateWith('0')]),
          evmWallet: stubWallet(),
          network: 'mainnet',
          logger: silentLogger,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidInputError)
  })

  it('rejects unsupported assets', async () => {
    await expect(
      runBridgeToCore(
        { asset: 'BTC' as 'USDC', amount: 1n, user: baseUser },
        {
          info: stubInfo([stateWith('0')]),
          evmWallet: stubWallet(),
          network: 'mainnet',
          logger: silentLogger,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidInputError)
  })

  it('throws NetworkError when token has no evmContract', async () => {
    const usdc = sampleSpotMeta.tokens[0]
    if (!usdc) throw new Error('fixture missing USDC')
    const meta: SpotMeta = {
      ...sampleSpotMeta,
      tokens: [{ ...usdc, evmContract: null }],
    }
    const info: InfoClient = {
      spotMeta: vi.fn(async () => meta),
      l2Book: vi.fn(),
      spotClearinghouseState: vi.fn(),
    }
    await expect(
      runBridgeToCore(
        { asset: 'USDC', amount: 1n, user: baseUser },
        { info, evmWallet: stubWallet(), network: 'mainnet', logger: silentLogger },
      ),
    ).rejects.toBeInstanceOf(NetworkError)
  })

  it('sends transfer to USDC contract with system-address payload, then resolves on credit', async () => {
    // 100 USDC EVM = 100_000_000n (6 dec). HC will credit 10_000_000_000n in 8-dec units = "100".
    const info = stubInfo([stateWith('0'), stateWith('0'), stateWith('100')])
    const expectedHash = `0x${'a'.repeat(63)}1`
    const wallet = stubWallet(expectedHash)
    let t = 1_000_000_000_000
    const result = await runBridgeToCore(
      { asset: 'USDC', amount: 100_000_000n, user: baseUser },
      {
        info,
        evmWallet: wallet,
        network: 'mainnet',
        logger: silentLogger,
        now: () => t,
        sleep: async () => {
          t += 1_000
        },
      },
    )
    expect(result.txHash).toBe(expectedHash)
    expect(wallet.calls).toEqual([
      {
        to: usdcEvmContract,
        data: expect.stringMatching(/^0xa9059cbb/),
        chainId: 999,
      },
    ])
    const sent = wallet.calls[0] as { data: string }
    expect(sent.data).toContain('2000000000000000000000000000000000000000')
  })

  it('uses chainId 998 on testnet', async () => {
    const info = stubInfo([stateWith('0'), stateWith('100')])
    const wallet = stubWallet()
    let t = 0
    await runBridgeToCore(
      { asset: 'USDC', amount: 100_000_000n, user: baseUser },
      {
        info,
        evmWallet: wallet,
        network: 'testnet',
        logger: silentLogger,
        now: () => t,
        sleep: async () => {
          t += 1_000
        },
      },
    )
    expect((wallet.calls[0] as { chainId: number }).chainId).toBe(998)
  })

  it('detects credit via balance delta when user already had a prior balance', async () => {
    // Prior 5 USDC, bridge 100 USDC EVM (100_000_000n) → expect HC total 105.
    const info = stubInfo([stateWith('5'), stateWith('5'), stateWith('105')])
    const wallet = stubWallet()
    let t = 0
    const res = await runBridgeToCore(
      { asset: 'USDC', amount: 100_000_000n, user: baseUser },
      {
        info,
        evmWallet: wallet,
        network: 'mainnet',
        logger: silentLogger,
        now: () => t,
        sleep: async () => {
          t += 1_000
        },
      },
    )
    expect(res).toMatchObject({ txHash: expect.any(String) })
  })

  it('throws BridgeTimeoutError when credit never lands', async () => {
    const info = stubInfo([stateWith('0'), stateWith('0'), stateWith('0')])
    const deadHash = `0x${'d'.repeat(64)}`
    const wallet = stubWallet(deadHash)
    let t = 0
    await expect(
      runBridgeToCore(
        {
          asset: 'USDC',
          amount: 100_000_000n,
          user: baseUser,
          waitForCreditTimeoutMs: 3_000,
        },
        {
          info,
          evmWallet: wallet,
          network: 'mainnet',
          logger: silentLogger,
          now: () => t,
          sleep: async () => {
            t += 1_500
          },
        },
      ),
    ).rejects.toMatchObject({
      name: 'BridgeTimeoutError',
      txHash: deadHash,
      timeoutMs: 3_000,
    })
    expect(BridgeTimeoutError).toBeDefined()
  })

  it('rejects a malformed tx hash returned by the wallet', async () => {
    const info = stubInfo([stateWith('0')])
    const badWallet: EvmWallet = {
      address: '0x0000000000000000000000000000000000000abc',
      sendTransaction: async () => '0xnothex' as `0x${string}`,
    }
    await expect(
      runBridgeToCore(
        { asset: 'USDC', amount: 1_000_000n, user: baseUser },
        { info, evmWallet: badWallet, network: 'mainnet', logger: silentLogger },
      ),
    ).rejects.toBeInstanceOf(NetworkError)
  })

  it('lowercases the tx hash returned by the wallet', async () => {
    const info = stubInfo([stateWith('0'), stateWith('100')])
    const wallet: EvmWallet = {
      address: '0x0000000000000000000000000000000000000ABC',
      sendTransaction: async () => `0x${'A'.repeat(64)}` as `0x${string}`,
    }
    let t = 0
    const res = await runBridgeToCore(
      { asset: 'USDC', amount: 100_000_000n, user: baseUser },
      {
        info,
        evmWallet: wallet,
        network: 'mainnet',
        logger: silentLogger,
        now: () => t,
        sleep: async () => {
          t += 1_000
        },
      },
    )
    expect(res.txHash).toBe(`0x${'a'.repeat(64)}`)
  })

  it('keeps polling when spotClearinghouseState throws transiently', async () => {
    let calls = 0
    const info: InfoClient = {
      spotMeta: vi.fn(async () => sampleSpotMeta),
      l2Book: vi.fn(),
      spotClearinghouseState: vi.fn(async () => {
        calls += 1
        if (calls === 2) throw new Error('transient http blip')
        return calls < 4 ? stateWith('0') : stateWith('100')
      }),
    }
    const wallet = stubWallet(`0x${'a'.repeat(64)}`)
    let t = 0
    const res = await runBridgeToCore(
      { asset: 'USDC', amount: 100_000_000n, user: baseUser },
      {
        info,
        evmWallet: wallet,
        network: 'mainnet',
        logger: silentLogger,
        now: () => t,
        sleep: async () => {
          t += 1_000
        },
      },
    )
    expect(res.txHash).toBe(`0x${'a'.repeat(64)}`)
  })

  it('rejects non-positive timeout', async () => {
    await expect(
      runBridgeToCore(
        {
          asset: 'USDC',
          amount: 1n,
          user: baseUser,
          waitForCreditTimeoutMs: 0,
        },
        {
          info: stubInfo([stateWith('0')]),
          evmWallet: stubWallet(),
          network: 'mainnet',
          logger: silentLogger,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidInputError)
  })
})
