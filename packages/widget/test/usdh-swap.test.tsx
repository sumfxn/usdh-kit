import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USDHSwap } from '../src/usdh-swap.js'

const HYPER_EVM_MAINNET_ID = 999
const STUB_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as const

const mockUseAccount = vi.fn<() => { isConnected: boolean; address?: `0x${string}` }>()
const mockUseWalletClient =
  vi.fn<
    () => {
      data:
        | {
            sendTransaction: () => Promise<unknown>
            signTypedData: () => Promise<`0x${string}`>
            signMessage: () => Promise<`0x${string}`>
          }
        | undefined
    }
  >()
const mockUseChainId = vi.fn<() => number>()
const mockSwitchChain = vi.fn()
const mockSignTypedDataAsync = vi.fn()
const mockSignMessageAsync = vi.fn()
const mockUseReadContract =
  vi.fn<() => { data: unknown; isLoading: boolean; refetch: () => void }>()
const mockUsePublicClient = vi.fn()
const mockGeneratePrivateKey = vi.fn<() => `0x${string}`>()
const mockPrivateKeyToAccount = vi.fn()

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
  useSignTypedData: () => ({ signTypedDataAsync: mockSignTypedDataAsync }),
  useSignMessage: () => ({ signMessageAsync: mockSignMessageAsync }),
  useChainId: () => mockUseChainId(),
  useSwitchChain: () => ({ switchChain: mockSwitchChain, isPending: false }),
  useReadContract: () => mockUseReadContract(),
  usePublicClient: () => mockUsePublicClient(),
}))

vi.mock('viem/accounts', () => ({
  generatePrivateKey: () => mockGeneratePrivateKey(),
  privateKeyToAccount: (privateKey: `0x${string}`) => mockPrivateKeyToAccount(privateKey),
}))

const mockHcQueryData = vi.fn<() => { usdc: bigint; usdh: bigint | undefined } | undefined>(
  () => undefined,
)
const mockTokenQueryData = vi.fn<() => unknown>(() => ({
  usdc: {
    evmAddress: '0xb88339CB7199b77E23DB6E890353E22632Ba630f',
    evmDecimals: 18,
    hcWeiDecimals: 8,
    hcTokenIndex: 0,
  },
  usdh: {
    evmAddress: '0x1111111111111111111111111111111111111111',
    evmDecimals: 18,
    hcWeiDecimals: 8,
    hcTokenIndex: 1,
  },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey.includes('stable-token-info')) {
      return { data: mockTokenQueryData(), isLoading: false, refetch: vi.fn() }
    }
    return { data: mockHcQueryData(), isLoading: false, refetch: vi.fn() }
  },
}))

const mockPreflightSwap = vi.fn()
const mockBridgeAndSwap = vi.fn()
const mockApproveAgent = vi.fn()

function makeQuote(estimatedReceived = 11_000_000n) {
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
    amount: overrides.amount ?? 11_000_000n,
    sourceChain,
    requiresBridge: overrides.requiresBridge ?? sourceChain === 'hyperevm',
    canSwap: overrides.canSwap ?? true,
    quote: makeQuote(overrides.estimatedReceived),
    hypercoreBalance,
    hypercoreTotal: overrides.hypercoreTotal ?? hypercoreBalance,
    hypercoreHold: overrides.hypercoreHold ?? 0n,
    hypercoreDecimals: overrides.hypercoreDecimals ?? 8,
    requiredHypercoreBalance: overrides.requiredHypercoreBalance ?? 1_104_400_000n,
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
      received: overrides.received ?? 11_000_000n,
      spent: route.amount,
      price: 1_000_000_000_000_000_000n,
      slippageBps: 0,
    },
  }
}

vi.mock('@usdh-kit/sdk', () => ({
  approveAgent: (...args: unknown[]) => mockApproveAgent(...args),
  createUsdhKit: () => ({
    preflightSwap: mockPreflightSwap,
    bridgeAndSwap: mockBridgeAndSwap,
  }),
  createInfoClient: () => ({
    spotMeta: vi.fn(async () => ({})),
    l2Book: vi.fn(async () => ({
      coin: '@230',
      levels: [[{ px: '0.9999', sz: '10', n: 1 }], [{ px: '1.0001', sz: '10', n: 1 }]],
    })),
    spotClearinghouseState: vi.fn(),
  }),
  listUsdhSpotPairs: () => [
    {
      name: '@230',
      label: 'USDH/USDC',
      index: 230,
      base: 'USDH',
      quote: 'USDC',
      usdhRole: 'base',
    },
  ],
  getHyperEvmNativeUsdcAddress: () => '0xb88339cb7199b77e23db6e890353e22632ba630f',
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

function setConnected({
  chainId = HYPER_EVM_MAINNET_ID,
  withSession = true,
}: { chainId?: number; withSession?: boolean } = {}) {
  mockUseAccount.mockReturnValue({ isConnected: true, address: STUB_ADDRESS })
  mockUseWalletClient.mockReturnValue({
    data: {
      sendTransaction: () => Promise.resolve('0xtx'),
      signTypedData: () => Promise.resolve(`0x${'c'.repeat(130)}` as `0x${string}`),
      signMessage: () => Promise.resolve('0x0'),
    },
  })
  if (withSession) seedAgentSession()
  mockUseChainId.mockReturnValue(chainId)
  mockUseReadContract.mockReturnValue({
    data: 1_000_000_000_000_000_000_000n,
    isLoading: false,
    refetch: vi.fn(),
  })
  mockUsePublicClient.mockReturnValue({
    waitForTransactionReceipt: vi.fn(async () => undefined),
  })
  mockHcQueryData.mockReturnValue({ usdc: 0n, usdh: 0n })
}

function seedAgentSession(network: 'mainnet' | 'testnet' = 'mainnet') {
  window.sessionStorage.setItem(
    `usdh-kit:agent-session:${network}:${STUB_ADDRESS.toLowerCase()}`,
    JSON.stringify({
      version: 1,
      network,
      accountAddress: STUB_ADDRESS.toLowerCase(),
      agentAddress: '0x00000000000000000000000000000000000000aa',
      agentName: `usdh-kit-${network}`,
      privateKey: `0x${'1'.repeat(64)}`,
      createdAt: Date.now(),
    }),
  )
}

describe('USDHSwap', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.sessionStorage.clear()
    mockGeneratePrivateKey.mockReturnValue(`0x${'2'.repeat(64)}`)
    mockPrivateKeyToAccount.mockReturnValue({
      address: '0x00000000000000000000000000000000000000aa',
      signTypedData: () => Promise.resolve(`0x${'a'.repeat(64)}${'b'.repeat(64)}1c`),
      signMessage: () => Promise.resolve('0x0'),
    })
    mockApproveAgent.mockResolvedValue({
      agentAddress: '0x00000000000000000000000000000000000000aa',
    })
    mockTokenQueryData.mockReturnValue({
      usdc: {
        evmAddress: '0xb88339CB7199b77E23DB6E890353E22632Ba630f',
        evmDecimals: 18,
        hcWeiDecimals: 8,
        hcTokenIndex: 0,
      },
      usdh: {
        evmAddress: '0x1111111111111111111111111111111111111111',
        evmDecimals: 18,
        hcWeiDecimals: 8,
        hcTokenIndex: 1,
      },
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

  it('renders the swap form when no wallet is connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    render(<USDHSwap network="testnet" />)

    expect(screen.getByText('You pay')).toBeInTheDocument()
    expect(screen.getByText('You receive')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect wallet to swap' })).toBeDisabled()
    expect(screen.queryByText(/Connect a wallet on HyperEVM Testnet/)).not.toBeInTheDocument()
  })

  it('syncs the internal network when the required network prop changes', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    const { rerender } = render(<USDHSwap network="mainnet" />)
    expect(screen.getByRole('button', { name: 'Mainnet' })).toHaveAttribute('aria-pressed', 'true')

    rerender(<USDHSwap network="testnet" />)
    expect(screen.getByRole('button', { name: 'Testnet' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Connect wallet to swap' })).toBeDisabled()
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
    expect(screen.getByText('HyperEVM balance')).toBeInTheDocument()
    expect(screen.getByText('HyperCore balance')).toBeInTheDocument()
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
    mockPreflightSwap.mockResolvedValue(makeRoute({ estimatedReceived: 10_999_800n }))

    render(<USDHSwap network="mainnet" />)

    await waitFor(
      () => {
        expect(mockPreflightSwap).toHaveBeenCalled()
      },
      { timeout: 2_000 },
    )
    await waitFor(() => {
      expect(screen.getByText('10.9998')).toBeInTheDocument()
    })
    // No bps drift noise rendered anywhere.
    expect(screen.queryByText(/bps/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Off parity/i)).not.toBeInTheDocument()
  })

  it('clears the previous quote as soon as the amount changes', async () => {
    setConnected()
    mockPreflightSwap
      .mockResolvedValueOnce(makeRoute({ estimatedReceived: 10_999_800n }))
      .mockImplementationOnce(() => new Promise(() => {}))

    render(<USDHSwap network="mainnet" defaultAmount="11" />)

    await waitFor(
      () => {
        expect(screen.getByText('10.9998')).toBeInTheDocument()
      },
      { timeout: 2_000 },
    )

    fireEvent.change(screen.getByLabelText('Amount in USDC'), { target: { value: '12' } })

    expect(screen.queryByText('10.9998')).not.toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
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

  it('blocks amounts at Hyperliquid minimum notional before sending a swap', () => {
    setConnected()
    mockPreflightSwap.mockImplementation(() => new Promise(() => {}))

    render(<USDHSwap network="mainnet" defaultAmount="10" />)

    expect(screen.getByText(/Use 11\+ USDC/)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Minimum 11 USDC' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(mockBridgeAndSwap).not.toHaveBeenCalled()
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

  it('requires an explicit trading session before the first swap', async () => {
    setConnected({ withSession: false })
    mockPreflightSwap.mockResolvedValue(makeRoute())

    render(<USDHSwap network="mainnet" />)

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Enable trading session' })).toBeInTheDocument()
      },
      { timeout: 2_000 },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enable trading session' }))

    await waitFor(() => {
      expect(mockApproveAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'mainnet',
          agentAddress: '0x00000000000000000000000000000000000000aa',
          agentName: 'usdh-kit-mainnet',
          signatureChainId: 999,
        }),
      )
    })
    expect(mockBridgeAndSwap).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bridge and swap' })).toBeInTheDocument()
    })
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

    // Inline note shows the bridge shape up front, no intermediate confirm
    // card; clicking the action button delegates the lifecycle to the SDK.
    expect(screen.getByText(/approve USDC, then deposit it to HyperCore spot/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bridge and swap' }))

    await waitFor(() => {
      expect(screen.getByText('Filled')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Exceeds your/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bridge and swap' })).not.toBeInTheDocument()
    expect(mockBridgeAndSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'USDC',
        amount: 11_000_000n,
        slippageBps: 30,
        sourceChain: 'auto',
        onProgress: expect.any(Function),
      }),
    )
    expect(onSwapComplete).toHaveBeenCalledWith({
      orderId: 'order-42',
      receivedUsdh: 11_000_000n,
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
    expect(screen.getByText(/Bridging usually credits in about 1-2 minutes/)).toBeInTheDocument()

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
    // 20 USDC on HC at 8 weiDecimals covers the 11 USDC default amount.
    mockHcQueryData.mockReturnValue({ usdc: 2_000_000_000n, usdh: 0n })
    mockPreflightSwap.mockResolvedValue(
      makeRoute({
        sourceChain: 'hypercore',
        requiresBridge: false,
        hypercoreBalance: 2_000_000_000n,
      }),
    )
    mockBridgeAndSwap.mockResolvedValue(
      makeBridgeAndSwapResult({
        route: makeRoute({
          sourceChain: 'hypercore',
          requiresBridge: false,
          hypercoreBalance: 2_000_000_000n,
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
    expect(screen.queryByRole('button', { name: 'Swap' })).not.toBeInTheDocument()
    expect(screen.queryByText('SLIPPAGE')).not.toBeInTheDocument()
    expect(mockBridgeAndSwap).toHaveBeenCalledWith(
      expect.objectContaining({ sourceChain: 'auto', onProgress: expect.any(Function) }),
    )
  })

  it('lets the user toggle source chain via the pill button', async () => {
    setConnected()
    // 20 USDC on HC covers the 11 USDC default even with slippage + fee buffer.
    mockHcQueryData.mockReturnValue({ usdc: 2_000_000_000n, usdh: 0n })
    mockPreflightSwap.mockResolvedValue(
      makeRoute({
        sourceChain: 'hypercore',
        requiresBridge: false,
        hypercoreBalance: 2_000_000_000n,
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
    // Default amount = 11 USDC, default slippage 30 bps + 10 bps fee buffer
    // means we need 11.044 USDC on HC to skip the bridge. 11.0 exactly is short.
    mockHcQueryData.mockReturnValue({ usdc: 1_100_000_000n, usdh: 0n })
    mockPreflightSwap.mockResolvedValue(makeRoute({ hypercoreBalance: 1_100_000_000n }))

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
      .mockResolvedValueOnce(makeRoute({ amount: 12_000_000n, estimatedReceived: 12_000_000n }))

    render(<USDHSwap network="mainnet" defaultAmount="11" />)
    await waitFor(
      () => {
        expect(mockPreflightSwap).toHaveBeenCalledTimes(1)
      },
      { timeout: 2_000 },
    )

    fireEvent.change(screen.getByLabelText('Amount in USDC'), { target: { value: '12' } })

    await waitFor(
      () => {
        expect(mockPreflightSwap).toHaveBeenCalledTimes(2)
      },
      { timeout: 2_000 },
    )
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
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
    expect(screen.getByLabelText('Sentral on X')).toBeInTheDocument()
    expect(screen.getByLabelText('LiquidTerminal on X')).toBeInTheDocument()

    rerender(<USDHSwap network="mainnet" hideAttribution />)
    expect(screen.queryByText(/Powered by/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sentral on X')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('LiquidTerminal on X')).not.toBeInTheDocument()
  })
})
