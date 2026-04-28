import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USDHSwap } from '../src/usdh-swap.js'

const mockUseAccount = vi.fn<() => { isConnected: boolean; address?: `0x${string}` }>()
const mockUseWalletClient =
  vi.fn<() => { data: { sendTransaction: () => Promise<unknown> } | undefined }>()

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
}))

const mockGetQuote = vi.fn()
const mockBridgeToCore = vi.fn()
const mockSwap = vi.fn()

vi.mock('@usdh-kit/sdk', () => ({
  createUsdhKit: () => ({
    getQuote: mockGetQuote,
    bridgeToCore: mockBridgeToCore,
    swap: mockSwap,
  }),
}))

function setConnected() {
  mockUseAccount.mockReturnValue({
    isConnected: true,
    address: '0x1234567890abcdef1234567890abcdef12345678',
  })
  mockUseWalletClient.mockReturnValue({
    data: { sendTransaction: () => Promise.resolve('0xtx') },
  })
}

describe('USDHSwap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the disconnected message when no wallet is connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })

    render(<USDHSwap network="testnet" />)

    expect(screen.getByText(/Connect a wallet on HyperEVM Testnet to swap/)).toBeInTheDocument()
  })

  it('shows the mainnet copy when network is mainnet', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })

    render(<USDHSwap network="mainnet" />)

    expect(screen.getByText(/Connect a wallet on HyperEVM Mainnet to swap/)).toBeInTheDocument()
  })

  it('renders the idle controls when connected', () => {
    setConnected()

    render(<USDHSwap network="testnet" />)

    expect(screen.getByLabelText('Amount (USDC)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get quote' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bridge and swap' })).toBeInTheDocument()
  })

  it('shows the estimated quote after Get quote resolves', async () => {
    setConnected()
    mockGetQuote.mockResolvedValue({
      pair: '@1338',
      midPrice: 1_000_000_000_000_000_000n,
      estimatedReceived: 999_823n,
      validUntil: Date.now() + 30_000,
    })

    render(<USDHSwap network="testnet" />)
    fireEvent.click(screen.getByRole('button', { name: 'Get quote' }))

    await waitFor(() => {
      expect(screen.getByText('Estimated out')).toBeInTheDocument()
    })
    expect(screen.getByText(/0\.999823 USDH/)).toBeInTheDocument()
    expect(screen.getByText(/pair @1338/)).toBeInTheDocument()
  })

  it('surfaces an error when Get quote rejects', async () => {
    setConnected()
    mockGetQuote.mockRejectedValue(new Error('upstream down'))

    render(<USDHSwap network="testnet" />)
    fireEvent.click(screen.getByRole('button', { name: 'Get quote' }))

    await waitFor(() => {
      expect(screen.getByText('upstream down')).toBeInTheDocument()
    })
  })

  it('renders the filled card when bridge and swap both succeed', async () => {
    setConnected()
    mockBridgeToCore.mockResolvedValue({ txHash: '0xabcdef0123456789abcdef0123456789abcdef01' })
    mockSwap.mockResolvedValue({
      orderId: 'order-42',
      received: 1_500_000n,
    })

    render(<USDHSwap network="mainnet" />)
    fireEvent.click(screen.getByRole('button', { name: 'Bridge and swap' }))

    await waitFor(() => {
      expect(screen.getByText('Filled')).toBeInTheDocument()
    })
    expect(screen.getByText(/1\.5 USDH/)).toBeInTheDocument()
    expect(screen.getByText(/order order-42/)).toBeInTheDocument()
  })
})
