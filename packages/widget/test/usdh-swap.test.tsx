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
const mockSignTypedDataAsync = vi.fn()
const mockSignMessageAsync = vi.fn()
const mockUseReadContract =
  vi.fn<() => { data: unknown; isLoading: boolean; refetch: () => void }>()

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
  useSignTypedData: () => ({ signTypedDataAsync: mockSignTypedDataAsync }),
  useSignMessage: () => ({ signMessageAsync: mockSignMessageAsync }),
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

const mockPreflightSwap = vi.fn()
const mockBridgeAndSwap = vi.fn()

function makeQuote(estimatedReceived = 1_000_000n) {
  return {
    pair: 'USDH/USDC',
    midPrice: 1_000_000_000_000_000_000n,
    estimatedReceived,
    validUntil: Date.now() + 30_000,
  }
}

function makeRoute(
  overrides: Partial<{
    amount: bigint
    sourceChain: 'hypercore' | 'hyperevm'
    requiresBridge: boolean
    canSwap: boolean
    estimatedReceived: bigint
    hypercoreBalance: bigint
    hypercoreTotal: bigint
    hypercoreHold: bigint
    hypercoreDecimals: number
    requiredHypercoreBalance: bigint
  }> = {},
) {
  const sourceChain = overrides.sourceChain ?? 'hyperevm'
  const hypercoreBalance = overrides.hypercoreBalance ?? 0n
  return {
    from: 'USDC',
    amount: overrides.amount ?? 1_000_000n,
    sourceChain,
    requiresBridge: overrides.requiresBridge ?? sourceChain === 'hyperevm',
    canSwap: overrides.canSwap ?? true,
    quote: makeQuote(overrides.estimatedReceived),
    hypercoreBalance,
    hypercoreTotal: overrides.hypercoreTotal ?? hypercoreBalance,
    hypercoreHold: overrides.hypercoreHold ?? 0n,
    hypercoreDecimals: overrides.hypercoreDecimals ?? 8,
    requiredHypercoreBalance: overrides.requiredHypercoreBalance ?? 100_400_000n,
  }
}

function makeBridgeAndSwapResult(
  overrides: Partial<{
    route: ReturnType<typeof makeRoute>
    bridge: { txHash: `0x${string}` }
    orderId: string
    received: bigint
  }> = {},
) {
  const route = overrides.route ?? makeRoute()
  return {
    route,
    ...(overrides.bridge !== undefined && { bridge: overrides.bridge }),
    swap: {
      orderId: overrides.orderId ?? 'order-42',
      received: overrides.received ?? 1_000_000n,
      spent: route.amount,
      price: 1_000_000_000_000_000_000n,
      slippageBps: 0,
    },
  }
}

vi.mock('@usdh-kit/sdk', () => ({
  createUsdhKit: () => ({
    preflightSwap: mockPreflightSwap,
    bridgeAndSwap: mockBridgeAndSwap,
  }),
  createInfoClient: () => ({
    spotMeta: vi.fn(),
    spotClearinghouseState: vi.fn(),
  }),
  BridgeAndSwapError: class extends Error {
    phase: string
    cause: unknown

    constructor(phase: string, cause: unknown) {
      super(cause instanceof Error ? cause.message : String(cause))
      this.phase = phase
      this.cause = cause
    }
  },
  isBridgeAndSwapError: (err: unknown) =>
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: unknown }).name === 'BridgeAndSwapError',
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
    vi.resetAllMocks()
    mockTokenQueryData.mockReturnValue({
      evmAddress: '0xb88339CB7199b77E23DB6E890353E22632Ba630f',
      evmDecimals: 18,
      hcWeiDecimals: 8,
      hcTokenIndex: 0,
    })
    mockHcQueryData.mockReturnValue(undefined)
    mockPreflightSwap.mockResolvedValue(makeRoute())
    mockBridgeAndSwap.mockResolvedValue(makeBridgeAndSwapResult())
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false, refetch: vi.fn() })
  })

  it('uses the required mainnet prop and shows the network toggle pill', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    render(<USDHSwap network="mainnet" />)

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

  it('syncs the internal network when the required network prop changes', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    const { rerender } = render(<USDHSwap network="mainnet" />)
    expect(screen.getByRole('button', { name: 'Mainnet' })).toHaveAttribute('aria-pressed', 'true')

    rerender(<USDHSwap network="testnet" />)
    expect(screen.getByRole('button', { name: 'Testnet' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Connect a wallet on HyperEVM Testnet/)).toBeInTheDocument()
  })

  it('renders the wrong-network row with a Switch button when chain id mismatches', () => {
    setConnected({ chainId: 1 })

    render(<USDHSwap network="mainnet" />)

    expect(screen.getByText('Wrong network')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Switch/ })).toBeInTheDocument()
  })

  it('renders the you-pay / you-receive cards and slippage chips when connected', () => {
    setConnected()
    mockPreflightSwap.mockImplementation(() => new Promise(() => {}))
    render(<USDHSwap network="mainnet" />)

    expect(screen.getByText('You pay')).toBeInTheDocument()
    expect(screen.getByText('You receive')).toBeInTheDocument()
    expect(screen.getByText('Slippage')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '0.30%' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bridge and swap' })).toBeInTheDocument()
  })

  it('mirrors the input amount as the receive estimate before the quote arrives', () => {
    setConnected()
    mockPreflightSwap.mockImplementation(() => new Promise(() => {}))
    render(<USDHSwap network="mainnet" defaultAmount="100" />)

    // both cards show 100 (You pay input value, You receive optimistic 1:1 mirror)
    expect(screen.getByDisplayValue('100')).toBeInTheDocument()
    // The you-receive headline shows 100 too.
    const headlines = screen.getAllByText('100')
    expect(headlines.length).toBeGreaterThanOrEqual(1)
  })

  it('switches the active slippage preset on click', () => {
    setConnected()
    mockPreflightSwap.mockImplementation(() => new Promise(() => {}))
    render(<USDHSwap network="mainnet" />)

    fireEvent.click(screen.getByRole('button', { name: '1.00%' }))

    expect(screen.getByRole('button', { name: '0.30%' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '1.00%' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('auto-fetches a quote (debounced) and renders the rounded receive estimate without bps noise', async () => {
    setConnected()
    mockPreflightSwap.mockResolvedValue(makeRoute({ estimatedReceived: 999_800n }))

    render(<USDHSwap network="mainnet" />)

    await waitFor(
      () => {
        expect(mockPreflightSwap).toHaveBeenCalled()
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

  it('clears the previous quote as soon as the amount changes', async () => {
    setConnected()
    mockPreflightSwap
      .mockResolvedValueOnce(makeRoute({ estimatedReceived: 999_800n }))
      .mockImplementationOnce(() => new Promise(() => {}))

    render(<USDHSwap network="mainnet" defaultAmount="1" />)

    await waitFor(
      () => {
        expect(screen.getByText('0.9998')).toBeInTheDocument()
      },
      { timeout: 2_000 },
    )

    fireEvent.change(screen.getByLabelText('Amount in USDC'), { target: { value: '2' } })

    expect(screen.queryByText('0.9998')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('surfaces a friendly error when the auto-quote rejects', async () => {
    setConnected()
    mockPreflightSwap.mockRejectedValue(new Error('upstream down'))

    render(<USDHSwap network="mainnet" />)

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
    mockPreflightSwap.mockImplementation(() => new Promise(() => {}))
    render(<USDHSwap network="mainnet" />)

    expect(screen.getByText(/Exceeds your HyperEVM USDC balance/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Insufficient HyperEVM USDC' })).toBeDisabled()
  })

  it('keeps the swap button disabled until route balances are loaded', () => {
    setConnected()
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: true, refetch: vi.fn() })
    mockHcQueryData.mockReturnValue(undefined)
    mockPreflightSwap.mockImplementation(() => new Promise(() => {}))

    render(<USDHSwap network="mainnet" />)

    const button = screen.getByRole('button', { name: 'Bridge and swap' })
    expect(button).toBeDisabled()

    fireEvent.click(button)
    expect(mockBridgeAndSwap).not.toHaveBeenCalled()
  })

  it('shows the inline system-address note up front and runs bridge+swap directly on click', async () => {
    setConnected()
    mockPreflightSwap.mockResolvedValue(makeRoute())
    mockBridgeAndSwap.mockResolvedValue(
      makeBridgeAndSwapResult({
        bridge: { txHash: '0xabcdef0123456789abcdef0123456789abcdef01' },
      }),
    )
    const onSwapComplete = vi.fn()

    render(<USDHSwap network="mainnet" onSwapComplete={onSwapComplete} />)

    // Inline note shows the system address up front, no intermediate confirm
    // card; clicking the action button delegates the lifecycle to the SDK.
    expect(screen.getByText(/0x2000…0000/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bridge and swap' }))

    await waitFor(() => {
      expect(screen.getByText('Filled')).toBeInTheDocument()
    })
    expect(mockBridgeAndSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'USDC',
        amount: 1_000_000n,
        slippageBps: 30,
        sourceChain: 'auto',
        onProgress: expect.any(Function),
      }),
    )
    expect(onSwapComplete).toHaveBeenCalledWith({
      orderId: 'order-42',
      receivedUsdh: 1_000_000n,
      txHash: '0xabcdef0123456789abcdef0123456789abcdef01',
    })
  })

  it('maps bridgeAndSwap progress events onto the primary button state', async () => {
    setConnected()
    const bridge = { txHash: '0xabcdef0123456789abcdef0123456789abcdef01' as const }
    let startSwap: () => void = () => {}
    let finishSwap: () => void = () => {}
    mockBridgeAndSwap.mockImplementation(async ({ onProgress }) => {
      const route = makeRoute()
      onProgress({ phase: 'route', route })
      onProgress({ phase: 'bridging', route })
      await new Promise<void>((resolve) => {
        startSwap = resolve
      })
      onProgress({ phase: 'swapping', route, bridge })
      await new Promise<void>((resolve) => {
        finishSwap = resolve
      })
      return makeBridgeAndSwapResult({ bridge })
    })

    render(<USDHSwap network="mainnet" />)

    fireEvent.click(screen.getByRole('button', { name: 'Bridge and swap' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Bridging/ })).toBeDisabled()
    })

    startSwap()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Swapping/ })).toBeDisabled()
    })

    finishSwap()
    await waitFor(() => {
      expect(screen.getByText('Filled')).toBeInTheDocument()
    })
  })

  it('keeps bridge failures labeled by lifecycle phase', async () => {
    setConnected()
    mockBridgeAndSwap.mockImplementation(async ({ onProgress }) => {
      const route = makeRoute()
      onProgress({ phase: 'bridging', route })
      throw new Error('deposit rejected')
    })

    render(<USDHSwap network="mainnet" />)

    fireEvent.click(screen.getByRole('button', { name: 'Bridge and swap' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Bridge failed: deposit rejected')
    })
  })

  it('skips the bridge step when the user already has enough USDC on HyperCore', async () => {
    setConnected()
    // 1.5 USDC on HC at 8 weiDecimals → 150_000_000n. Default amount is 1 USDC,
    // requiring 100_000_000n in HC units, so HC is sufficient and bridge is skipped.
    mockHcQueryData.mockReturnValue(150_000_000n)
    mockPreflightSwap.mockResolvedValue(
      makeRoute({
        sourceChain: 'hypercore',
        requiresBridge: false,
        hypercoreBalance: 150_000_000n,
      }),
    )
    mockBridgeAndSwap.mockResolvedValue(
      makeBridgeAndSwapResult({
        route: makeRoute({
          sourceChain: 'hypercore',
          requiresBridge: false,
          hypercoreBalance: 150_000_000n,
        }),
        orderId: 'order-7',
      }),
    )

    render(<USDHSwap network="mainnet" />)

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
    expect(mockBridgeAndSwap).toHaveBeenCalledWith(
      expect.objectContaining({ sourceChain: 'auto', onProgress: expect.any(Function) }),
    )
  })

  it('lets the user toggle source chain via the pill button', async () => {
    setConnected()
    // 5 USDC on HC — covers the 1 USDC default even with slippage + fee buffer.
    mockHcQueryData.mockReturnValue(500_000_000n)
    mockPreflightSwap.mockResolvedValue(
      makeRoute({
        sourceChain: 'hypercore',
        requiresBridge: false,
        hypercoreBalance: 500_000_000n,
      }),
    )

    render(<USDHSwap network="mainnet" />)

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
    mockPreflightSwap.mockResolvedValue(makeRoute({ hypercoreBalance: 100_000_000n }))

    render(<USDHSwap network="mainnet" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bridge and swap' })).toBeInTheDocument()
    })
  })

  it('discards stale quote responses when the amount changes mid-flight', async () => {
    setConnected()
    let resolveStale: (q: unknown) => void = () => {}
    mockPreflightSwap
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveStale = r as (q: unknown) => void
          }),
      )
      .mockResolvedValueOnce(makeRoute({ amount: 2_000_000n, estimatedReceived: 2_000_000n }))

    render(<USDHSwap network="mainnet" defaultAmount="1" />)
    await waitFor(
      () => {
        expect(mockPreflightSwap).toHaveBeenCalledTimes(1)
      },
      { timeout: 2_000 },
    )

    fireEvent.change(screen.getByLabelText('Amount in USDC'), { target: { value: '2' } })

    await waitFor(
      () => {
        expect(mockPreflightSwap).toHaveBeenCalledTimes(2)
      },
      { timeout: 2_000 },
    )
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    // Late-arriving response from the stale request must NOT clobber the
    // headline — the request-id guard discards it.
    resolveStale(makeRoute({ estimatedReceived: 999_000n }))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('0.999')).not.toBeInTheDocument()
  })

  it('renders the watermark by default and hides it when hideAttribution is true', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    const { rerender } = render(<USDHSwap network="mainnet" />)
    expect(screen.getByText(/Powered by/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Sentral')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('LiquidTerminal')).not.toBeInTheDocument()

    rerender(<USDHSwap network="mainnet" hideAttribution />)
    expect(screen.queryByText(/Powered by/)).not.toBeInTheDocument()
  })
})
