import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUsdhKit } from '../src/use-usdh-kit.js'

const mockUseAccount = vi.fn<() => { address?: `0x${string}` }>()
const mockUseWalletClient =
  vi.fn<() => { data: { sendTransaction: () => Promise<unknown> } | undefined }>()
const signTypedDataAsync = vi.fn()
const signMessageAsync = vi.fn()

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
  useSignTypedData: () => ({ signTypedDataAsync }),
  useSignMessage: () => ({ signMessageAsync }),
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
    const walletClient = { sendTransaction: () => Promise.resolve('0xtx' as const) }
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
    const walletClient = { sendTransaction: () => Promise.resolve('0xtx' as const) }
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
})
