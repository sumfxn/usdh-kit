import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USDHSwap } from '../src/usdh-swap.js'

const HYPER_EVM_MAINNET_ID = 999
const STUB_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as const

const mockUseAccount = vi.fn<() => { isConnected: boolean; address?: `0x${string}` }>()
const mockUseWalletClient =
  vi.fn<() => { data: { sendTransaction: () => Promise<unknown> } | undefined }>()
const mockUseChainId = vi.fn<() => number>()
const mockSwitchChain = vi.fn()
const mockUseReadContract =
  vi.fn<() => { data: unknown; isLoading: boolean; refetch: () => void }>()

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
  useChainId: () => mockUseChainId(),
  useSwitchChain: () => ({ switchChain: mockSwitchChain, isPending: false }),
  useReadContract: () => mockUseReadContract(),
}))

const mockHcQueryData = vi.fn<() => bigint | undefined>(() => undefined)
const mockTokenQueryData = vi.fn<() => unknown>(() => ({
  evmAddress: '0xb88339CB7199b77E23DB6E890353E22632Ba630f',
  evmDecimals: 18,
  hcWeiDecimals: 8,
  hcTokenIndex: 0,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey.includes('usdc-token-info')) {
      return { data: mockTokenQueryData(), isLoading: false, refetch: vi.fn() }
    }
    return { data: mockHcQueryData(), isLoading: false, refetch: vi.fn() }
  },
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
  createInfoClient: () => ({
    spotMeta: vi.fn(),
    spotClearinghouseState: vi.fn(),
  }),
  BridgeTimeoutError: class extends Error {},
  InsufficientBalanceError: class extends Error {},
  InvalidInputError: class extends Error {},
  MissingEvmWalletError: class extends Error {},
  NetworkError: class extends Error {},
  NotImplementedError: class extends Error {},
  SigningError: class extends Error {},
  UsdhKitError: class extends Error {},
}))

function setConnected({ chainId = HYPER_EVM_MAINNET_ID }: { chainId?: number } = {}) {
  mockUseAccount.mockReturnValue({ isConnected: true, address: STUB_ADDRESS })
  mockUseWalletClient.mockReturnValue({
    data: { sendTransaction: () => Promise.resolve('0xtx') },
  })
  mockUseChainId.mockReturnValue(chainId)
  mockUseReadContract.mockReturnValue({
    data: 1_000_000_000_000_000_000_000n,
    isLoading: false,
    refetch: vi.fn(),
  })
  mockHcQueryData.mockReturnValue(0n)
}

describe('USDHSwap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTokenQueryData.mockReturnValue({
      evmAddress: '0xb88339CB7199b77E23DB6E890353E22632Ba630f',
      evmDecimals: 18,
      hcWeiDecimals: 8,
      hcTokenIndex: 0,
    })
    mockHcQueryData.mockReturnValue(undefined)
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false, refetch: vi.fn() })
  })

  it('defaults to mainnet and shows the network toggle pill', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    render(<USDHSwap />)

    expect(screen.getByRole('button', { name: 'Mainnet' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Testnet' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders the connect prompt when no wallet is connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    render(<USDHSwap network="testnet" />)

    expect(screen.getByText(/Connect a wallet on HyperEVM Testnet/)).toBeInTheDocument()
  })

  it('renders the wrong-network row with a Switch button when chain id mismatches', () => {
    setConnected({ chainId: 1 })

    render(<USDHSwap />)

    expect(screen.getByText('Wrong network')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Switch/ })).toBeInTheDocument()
  })

  it('renders the you-pay / you-receive cards and slippage chips when connected', () => {
    setConnected()
    mockGetQuote.mockImplementation(() => new Promise(() => {}))
    render(<USDHSwap />)

    expect(screen.getByText('You pay')).toBeInTheDocument()
    expect(screen.getByText('You receive')).toBeInTheDocument()
    expect(screen.getByText('Slippage')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '0.30%' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bridge and swap' })).toBeInTheDocument()
  })

  it('mirrors the input amount as the receive estimate before the quote arrives', () => {
    setConnected()
    mockGetQuote.mockImplementation(() => new Promise(() => {}))
    render(<USDHSwap defaultAmount="100" />)

    // both cards show 100 (You pay input value, You receive optimistic 1:1 mirror)
    expect(screen.getByDisplayValue('100')).toBeInTheDocument()
    // The you-receive headline shows 100 too.
    const headlines = screen.getAllByText('100')
    expect(headlines.length).toBeGreaterThanOrEqual(1)
  })

  it('switches the active slippage preset on click', () => {
    setConnected()
    mockGetQuote.mockImplementation(() => new Promise(() => {}))
    render(<USDHSwap />)

    fireEvent.click(screen.getByRole('button', { name: '1.00%' }))

    expect(screen.getByRole('button', { name: '0.30%' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '1.00%' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('auto-fetches a quote (debounced) and renders the rounded receive estimate without bps noise', async () => {
    setConnected()
    mockGetQuote.mockResolvedValue({
      pair: 'USDH/USDC',
      midPrice: 1_000_200_000_000_000_000n,
      estimatedReceived: 999_800n,
      validUntil: Date.now() + 30_000,
    })

    render(<USDHSwap />)

    await waitFor(
      () => {
        expect(mockGetQuote).toHaveBeenCalled()
      },
      { timeout: 2_000 },
    )
    await waitFor(() => {
      expect(screen.getByText('0.9998')).toBeInTheDocument()
    })
    // No bps drift noise rendered anywhere.
    expect(screen.queryByText(/bps/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Off parity/i)).not.toBeInTheDocument()
  })

  it('surfaces a friendly error when the auto-quote rejects', async () => {
    setConnected()
    mockGetQuote.mockRejectedValue(new Error('upstream down'))

    render(<USDHSwap />)

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toHaveTextContent('upstream down')
      },
      { timeout: 2_000 },
    )
  })

  it('disables the swap button and labels it Insufficient balance when amount > balance', () => {
    setConnected()
    mockUseReadContract.mockReturnValue({
      data: 500_000_000_000_000_000n,
      isLoading: false,
      refetch: vi.fn(),
    })
    mockGetQuote.mockImplementation(() => new Promise(() => {}))
    render(<USDHSwap />)

    expect(screen.getByText(/Exceeds your HyperEVM USDC balance/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Insufficient HyperEVM USDC' })).toBeDisabled()
  })

  it('shows the inline system-address note up front and runs bridge+swap directly on click', async () => {
    setConnected()
    mockGetQuote.mockResolvedValue({
      pair: 'USDH/USDC',
      midPrice: 1_000_000_000_000_000_000n,
      estimatedReceived: 1_000_000n,
      validUntil: Date.now() + 30_000,
    })
    mockBridgeToCore.mockResolvedValue({ txHash: '0xabcdef0123456789abcdef0123456789abcdef01' })
    mockSwap.mockResolvedValue({ orderId: 'order-42', received: 1_000_000n })
    const onSwapComplete = vi.fn()

    render(<USDHSwap onSwapComplete={onSwapComplete} />)

    // Inline note shows the system address up front, no intermediate confirm
    // card; clicking the action button fires the bridge tx directly.
    expect(screen.getByText(/0x2000…0000/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bridge and swap' }))

    await waitFor(() => {
      expect(screen.getByText('Filled')).toBeInTheDocument()
    })
    expect(mockBridgeToCore).toHaveBeenCalledWith({ asset: 'USDC', amount: 1_000_000n })
    expect(onSwapComplete).toHaveBeenCalledWith({
      orderId: 'order-42',
      receivedUsdh: 1_000_000n,
      txHash: '0xabcdef0123456789abcdef0123456789abcdef01',
    })
  })

  it('skips the bridge step when the user already has enough USDC on HyperCore', async () => {
    setConnected()
    // 1.5 USDC on HC at 8 weiDecimals → 150_000_000n. Default amount is 1 USDC,
    // requiring 100_000_000n in HC units, so HC is sufficient and bridge is skipped.
    mockHcQueryData.mockReturnValue(150_000_000n)
    mockGetQuote.mockResolvedValue({
      pair: 'USDH/USDC',
      midPrice: 1_000_000_000_000_000_000n,
      estimatedReceived: 1_000_000n,
      validUntil: Date.now() + 30_000,
    })
    mockSwap.mockResolvedValue({ orderId: 'order-7', received: 1_000_000n })

    render(<USDHSwap />)

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Swap' })).toBeInTheDocument()
      },
      { timeout: 2_000 },
    )
    expect(screen.getByRole('button', { name: /Source chain: HyperCore/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))

    await waitFor(() => {
      expect(screen.getByText('Filled')).toBeInTheDocument()
    })
    expect(mockBridgeToCore).not.toHaveBeenCalled()
    expect(mockSwap).toHaveBeenCalled()
  })

  it('lets the user toggle source chain via the pill button', async () => {
    setConnected()
    // 5 USDC on HC — covers the 1 USDC default even with slippage + fee buffer.
    mockHcQueryData.mockReturnValue(500_000_000n)
    mockGetQuote.mockImplementation(() => new Promise(() => {}))

    render(<USDHSwap />)

    // Auto-default is HC since it covers — primary button should read "Swap"
    // and the source pill should advertise HyperCore.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Swap' })).toBeInTheDocument()
    })
    const pill = screen.getByRole('button', { name: /Source chain: HyperCore/ })
    expect(pill).toHaveTextContent(/from HyperCore/)

    // Click the pill — flips to HyperEVM, primary button becomes "Bridge and swap".
    fireEvent.click(pill)
    expect(screen.getByRole('button', { name: /Source chain: HyperEVM/ })).toHaveTextContent(
      /from HyperEVM/,
    )
    expect(screen.getByRole('button', { name: 'Bridge and swap' })).toBeInTheDocument()
  })

  it('still requires the bridge when HC balance equals the trade exactly (slippage+fee buffer)', async () => {
    setConnected()
    // Default amount = 1 USDC, default slippage 30 bps + 10 bps fee buffer
    // means we need 1.004 USDC on HC to skip the bridge. 1.0 exactly is short.
    mockHcQueryData.mockReturnValue(100_000_000n)
    mockGetQuote.mockImplementation(() => new Promise(() => {}))

    render(<USDHSwap />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bridge and swap' })).toBeInTheDocument()
    })
  })

  it('discards stale quote responses when the amount changes mid-flight', async () => {
    setConnected()
    let resolveStale: (q: unknown) => void = () => {}
    mockGetQuote
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveStale = r as (q: unknown) => void
          }),
      )
      .mockResolvedValueOnce({
        pair: 'USDH/USDC',
        midPrice: 1_000_000_000_000_000_000n,
        estimatedReceived: 2_000_000n,
        validUntil: Date.now() + 30_000,
      })

    render(<USDHSwap defaultAmount="1" />)
    await waitFor(
      () => {
        expect(mockGetQuote).toHaveBeenCalledTimes(1)
      },
      { timeout: 2_000 },
    )

    fireEvent.change(screen.getByLabelText('Amount in USDC'), { target: { value: '2' } })

    await waitFor(
      () => {
        expect(mockGetQuote).toHaveBeenCalledTimes(2)
      },
      { timeout: 2_000 },
    )
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    // Late-arriving response from the stale request must NOT clobber the
    // headline — the request-id guard discards it.
    resolveStale({
      pair: 'USDH/USDC',
      midPrice: 1_000_000_000_000_000_000n,
      estimatedReceived: 999_000n,
      validUntil: Date.now() + 30_000,
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('0.999')).not.toBeInTheDocument()
  })

  it('renders the watermark by default and hides it when hideAttribution is true', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    const { rerender } = render(<USDHSwap />)
    expect(screen.getByText(/Powered by/)).toBeInTheDocument()

    rerender(<USDHSwap hideAttribution />)
    expect(screen.queryByText(/Powered by/)).not.toBeInTheDocument()
  })
})
