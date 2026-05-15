import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USDHMigration } from '../src/usdh-migration.js'

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
const mockUseReadContract =
  vi.fn<() => { data: unknown; isLoading: boolean; refetch: () => void }>()
const mockUsePublicClient = vi.fn()
const mockGeneratePrivateKey = vi.fn<() => `0x${string}`>()
const mockPrivateKeyToAccount = vi.fn()

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
  useChainId: () => mockUseChainId(),
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
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
const mockSwap = vi.fn()
const mockApproveAgent = vi.fn()

function makeQuote(estimatedReceived = 11_000_000n) {
  return {
    from: 'USDH',
    to: 'USDC',
    pair: 'USDH/USDC',
    midPrice: 1_000_000_000_000_000_000n,
    estimatedReceived,
    validUntil: Date.now() + 30_000,
  }
}

function makeRoute(
  overrides: Partial<{
    amount: bigint
    canSwap: boolean
    estimatedReceived: bigint
    hypercoreBalance: bigint
    requiredHypercoreBalance: bigint
  }> = {},
) {
  const hypercoreBalance = overrides.hypercoreBalance ?? 2_000_000_000n
  return {
    from: 'USDH',
    to: 'USDC',
    amount: overrides.amount ?? 11_000_000n,
    sourceChain: 'hypercore',
    requiresBridge: false,
    canSwap: overrides.canSwap ?? true,
    quote: makeQuote(overrides.estimatedReceived),
    hypercoreBalance,
    hypercoreTotal: hypercoreBalance,
    hypercoreHold: 0n,
    hypercoreDecimals: 8,
    requiredHypercoreBalance: overrides.requiredHypercoreBalance ?? 11_000_000n,
  }
}

function makeSwapResult(overrides: Partial<{ orderId: string; received: bigint }> = {}) {
  return {
    orderId: overrides.orderId ?? 'order-42',
    received: overrides.received ?? 11_000_000n,
    spent: 11_000_000n,
    price: 1_000_000_000_000_000_000n,
    slippageBps: 0,
  }
}

vi.mock('@usdh-kit/sdk', () => ({
  approveAgent: (...args: unknown[]) => mockApproveAgent(...args),
  createUsdhKit: () => ({
    preflightSwap: mockPreflightSwap,
    swap: mockSwap,
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
  BridgeAndSwapError: class extends Error {},
  isBridgeAndSwapError: () => false,
  BridgeTimeoutError: class extends Error {},
  InsufficientBalanceError: class extends Error {},
  InvalidInputError: class extends Error {},
  MissingEvmWalletError: class extends Error {},
  NetworkError: class extends Error {},
  NotImplementedError: class extends Error {},
  SigningError: class extends Error {},
  UsdhKitError: class extends Error {},
}))

function setConnected({ withSession = true }: { withSession?: boolean } = {}) {
  mockUseAccount.mockReturnValue({ isConnected: true, address: STUB_ADDRESS })
  mockUseWalletClient.mockReturnValue({
    data: {
      sendTransaction: () => Promise.resolve('0xtx'),
      signTypedData: () => Promise.resolve(`0x${'c'.repeat(130)}` as `0x${string}`),
      signMessage: () => Promise.resolve('0x0'),
    },
  })
  if (withSession) seedAgentSession()
  mockUseChainId.mockReturnValue(999)
  mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false, refetch: vi.fn() })
  mockUsePublicClient.mockReturnValue({
    waitForTransactionReceipt: vi.fn(async () => undefined),
  })
  // 20 USDH on HyperCore at 8 weiDecimals covers the 11 USDH default amount.
  mockHcQueryData.mockReturnValue({ usdc: 0n, usdh: 2_000_000_000n })
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

describe('USDHMigration', () => {
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
    mockSwap.mockResolvedValue(makeSwapResult())
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false, refetch: vi.fn() })
  })

  it('renders the migration form with the sunset notice and USDH/USDC tickers', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    render(<USDHMigration network="mainnet" />)

    expect(screen.getByText('Migrate USDH to USDC')).toBeInTheDocument()
    expect(screen.getByText(/USDH is being sunset on Hyperliquid/)).toBeInTheDocument()
    expect(screen.getByText('You pay')).toBeInTheDocument()
    expect(screen.getByText('You receive')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount in USDH')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect wallet to swap' })).toBeDisabled()
  })

  it('auto-fetches a quote (debounced) and renders the rounded USDC receive estimate', async () => {
    setConnected()
    mockPreflightSwap.mockResolvedValue(makeRoute({ estimatedReceived: 10_999_800n }))

    render(<USDHMigration network="mainnet" />)

    await waitFor(
      () => {
        expect(mockPreflightSwap).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'USDH',
            to: 'USDC',
            amount: 11_000_000n,
            sourceChain: 'hypercore',
          }),
        )
      },
      { timeout: 2_000 },
    )
    await waitFor(() => {
      expect(screen.getByText('10.9998')).toBeInTheDocument()
    })
  })

  it('surfaces a friendly error when the auto-quote rejects', async () => {
    setConnected()
    mockPreflightSwap.mockRejectedValue(new Error('upstream down'))

    render(<USDHMigration network="mainnet" />)

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toHaveTextContent('upstream down')
      },
      { timeout: 2_000 },
    )
  })

  it('blocks amounts below the Hyperliquid minimum notional', () => {
    setConnected()
    mockPreflightSwap.mockImplementation(() => new Promise(() => {}))

    render(<USDHMigration network="mainnet" defaultAmount="10" />)

    expect(screen.getByText(/Use 11\+ USDH/)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Minimum 11 USDH' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(mockSwap).not.toHaveBeenCalled()
  })

  it('disables the button and labels it Insufficient when amount exceeds the USDH balance', async () => {
    setConnected()
    mockPreflightSwap.mockResolvedValue(makeRoute({ canSwap: false }))

    render(<USDHMigration network="mainnet" />)

    await waitFor(() => {
      expect(screen.getByText(/Exceeds your HyperCore USDH balance/)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Insufficient HyperCore USDH' })).toBeDisabled()
  })

  it('requires an explicit trading session before the first migration', async () => {
    setConnected({ withSession: false })

    render(<USDHMigration network="mainnet" />)

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Enable trading session' })).not.toBeDisabled()
      },
      { timeout: 2_000 },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enable trading session' }))

    await waitFor(() => {
      expect(mockApproveAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'mainnet',
          agentName: 'usdh-kit-mainnet',
        }),
      )
    })
    expect(mockSwap).not.toHaveBeenCalled()
  })

  it('submits the migration swap and shows the filled USDC receipt', async () => {
    setConnected()
    mockSwap.mockResolvedValue(makeSwapResult({ orderId: 'order-7', received: 10_998_000n }))
    const onMigrationComplete = vi.fn()

    render(<USDHMigration network="mainnet" onMigrationComplete={onMigrationComplete} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Swap' })).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))

    await waitFor(() => {
      expect(screen.getByText('Filled')).toBeInTheDocument()
    })
    expect(screen.getByText(/10\.998 USDC/)).toBeInTheDocument()
    expect(mockSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'USDH',
        to: 'USDC',
        amount: 11_000_000n,
        slippageBps: 30,
      }),
    )
    expect(onMigrationComplete).toHaveBeenCalledWith({
      orderId: 'order-7',
      receivedUsdh: 10_998_000n,
    })
  })

  it('renders the watermark by default and hides it when hideAttribution is true', () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseWalletClient.mockReturnValue({ data: undefined })
    mockUseChainId.mockReturnValue(0)

    const { rerender } = render(<USDHMigration network="mainnet" />)
    expect(screen.getByText(/Powered by/)).toBeInTheDocument()

    rerender(<USDHMigration network="mainnet" hideAttribution />)
    expect(screen.queryByText(/Powered by/)).not.toBeInTheDocument()
  })
})
