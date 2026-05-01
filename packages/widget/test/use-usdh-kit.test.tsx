import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUsdhKit } from '../src/use-usdh-kit.js'

const mockUseAccount = vi.fn<() => { address?: `0x${string}` }>()
const mockUseWalletClient =
  vi.fn<
    () => {
      data:
        | {
            sendTransaction: () => Promise<unknown>
            signTypedData: (args: unknown) => Promise<unknown>
            signMessage: (args: unknown) => Promise<unknown>
          }
        | undefined
    }
  >()

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
}))

const createKitMock = vi.fn(() => ({ network: 'testnet' }))

vi.mock('@usdh-kit/sdk', () => ({
  createUsdhKit: (config: { network: string }) => createKitMock(config),
}))

describe('useUsdhKit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null until address and walletClient are both available', () => {
    mockUseAccount.mockReturnValue({})
    mockUseWalletClient.mockReturnValue({ data: undefined })

    const { result } = renderHook(() => useUsdhKit('testnet'))

    expect(result.current).toBeNull()
    expect(createKitMock).not.toHaveBeenCalled()
  })

  it('reuses the same kit instance across renders when inputs are stable', () => {
    const walletClient = makeWalletClient()
    mockUseAccount.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
    })
    mockUseWalletClient.mockReturnValue({ data: walletClient })

    const { result, rerender } = renderHook(() => useUsdhKit('testnet'))
    const first = result.current
    rerender()
    rerender()
    const last = result.current

    expect(first).not.toBeNull()
    expect(last).toBe(first)
    expect(createKitMock).toHaveBeenCalledTimes(1)
  })

  it('rebuilds the kit when network changes', () => {
    const walletClient = makeWalletClient()
    mockUseAccount.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
    })
    mockUseWalletClient.mockReturnValue({ data: walletClient })

    const { result, rerender } = renderHook(
      ({ network }: { network: 'mainnet' | 'testnet' }) => useUsdhKit(network),
      { initialProps: { network: 'testnet' } },
    )
    const first = result.current
    rerender({ network: 'mainnet' })
    const second = result.current

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(second).not.toBe(first)
    expect(createKitMock).toHaveBeenCalledTimes(2)
  })

  it('signs typed data through the wallet client directly', async () => {
    const walletClient = makeWalletClient()
    mockUseAccount.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
    })
    mockUseWalletClient.mockReturnValue({ data: walletClient })

    renderHook(() => useUsdhKit('mainnet'))

    const config = createKitMock.mock.calls[0]?.[0] as {
      signer: { signTypedData: (args: unknown) => Promise<unknown> }
    }
    await expect(
      config.signer.signTypedData({
        domain: { name: 'Exchange', version: '1', chainId: 1337 },
        types: {},
        primaryType: 'Agent',
        message: {},
      }),
    ).resolves.toBe('0xsignedTypedData')
    expect(walletClient.signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        account: '0x1234567890abcdef1234567890abcdef12345678',
        domain: expect.objectContaining({ name: 'Exchange', chainId: 1337 }),
      }),
    )
  })
})

function makeWalletClient() {
  return {
    sendTransaction: vi.fn(() => Promise.resolve('0xtx' as const)),
    signTypedData: vi.fn(() => Promise.resolve('0xsignedTypedData' as const)),
    signMessage: vi.fn(() => Promise.resolve('0xsignedMessage' as const)),
  }
}
