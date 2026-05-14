'use client'

import {
  BridgeTimeoutError,
  createInfoClient,
  isBridgeAndSwapError,
  listUsdhSpotPairs,
} from '@usdh-kit/sdk'
import type { Quote, SwapRoute } from '@usdh-kit/sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'

import { HYPER_EVM_CHAIN_ID } from './chains.js'
import { ActionButton } from './components/action-button.js'
import { ArrowDivider } from './components/arrow-divider.js'
import { BalanceRow } from './components/balance-row.js'
import { ErrorAlert } from './components/error-alert.js'
import { InlineSystemAddressNote } from './components/inline-system-address-note.js'
import { NetworkToggle } from './components/network-toggle.js'
import { PayCard } from './components/pay-card.js'
import { ReceiveCard } from './components/receive-card.js'
import { ResultPanel } from './components/result-panel.js'
import { SlippageRow } from './components/slippage-row.js'
import type { SourceChain } from './components/source-chain-pill.js'
import { WrongNetworkBanner } from './components/wrong-network-banner.js'
import { formatUsd, scaleAmount, trimReceive } from './format-display.js'
import { formatUnits, parseUnits } from './format.js'
import { friendlyError } from './friendly-error.js'
import type { HyperNetwork, SwapResultPayload, WidgetTheme } from './types.js'
import { useAgentWalletKit } from './use-agent-wallet-kit.js'
import { useUsdcBalances } from './use-balances.js'
import { useCountdown } from './use-countdown.js'
import { useEffectiveTheme } from './use-theme.js'
import { Watermark } from './watermark.js'

const USDC_DECIMALS = 6
const MIN_SWAP_AMOUNT = 10_000_001n
const MIN_SWAP_DISPLAY = '11'
const QUOTE_DEBOUNCE_MS = 400
const READ_ONLY_QUOTE_TIMEOUT_MS = 1_500
const PRICE_DECIMALS = 18

type Phase = 'idle' | 'approving' | 'bridging' | 'swapping' | 'done'

export type USDHSwapProps = {
  /** HyperEVM network the swap targets. */
  network: HyperNetwork
  /** Hide the in-widget testnet/mainnet toggle. Defaults to false. */
  hideNetworkToggle?: boolean
  /** Hide the "Powered by usdh-kit" footer. Defaults to false. */
  hideAttribution?: boolean
  /**
   * Theme palette. Defaults to `'auto'` (follows the user's system
   * preference via `prefers-color-scheme`). Set to `'dark'` or `'light'`
   * to force a specific palette.
   */
  theme?: WidgetTheme
  /** Default slippage in basis points (10 = 0.10%). Defaults to 30. */
  defaultSlippageBps?: number
  /** Pre-fill the pay amount as a decimal string. */
  defaultAmount?: string
  /** Called when a swap fills successfully. */
  onSwapComplete?: (result: SwapResultPayload) => void
}

export function USDHSwap(props: USDHSwapProps) {
  const {
    network: initialNetwork,
    hideNetworkToggle = false,
    hideAttribution = false,
    theme = 'auto',
    defaultSlippageBps = 30,
    defaultAmount = '11',
    onSwapComplete,
  } = props

  const effectiveTheme = useEffectiveTheme(theme)
  const [network, setNetwork] = useState<HyperNetwork>(initialNetwork)
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { kit, sessionReady, isApprovingSession, enableTradingSession } = useAgentWalletKit(network)
  const balances = useUsdcBalances(network, address)

  const [amountStr, setAmountStr] = useState(defaultAmount)
  const [slippageBps, setSlippageBps] = useState(defaultSlippageBps)
  const [customSlippageStr, setCustomSlippageStr] = useState('')
  const [showCustomSlippage, setShowCustomSlippage] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [route, setRoute] = useState<SwapRoute | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)
  const [readOnlyEstimate, setReadOnlyEstimate] = useState<bigint | null>(null)
  const [isReadOnlyQuoting, setIsReadOnlyQuoting] = useState(false)
  const [result, setResult] = useState<SwapResultPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bridgeStartedAt, setBridgeStartedAt] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const expectedChainId = HYPER_EVM_CHAIN_ID[network]
  const onWrongChain = isConnected && chainId !== expectedChainId

  const quoteExpirySeconds = useCountdown(quote?.validUntil ?? null)

  const busy = phase === 'approving' || phase === 'bridging' || phase === 'swapping'
  const showingResult = phase === 'done' && result !== null
  const networkToggleLocked = busy

  useEffect(() => {
    if (!networkToggleLocked) setNetwork(initialNetwork)
  }, [initialNetwork, networkToggleLocked])

  useEffect(() => {
    if (phase !== 'bridging') {
      setBridgeStartedAt(null)
      return
    }
    setNowMs(Date.now())
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (quote && quoteExpirySeconds === 0) setQuote(null)
  }, [quote, quoteExpirySeconds])

  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amountStr || '0', USDC_DECIMALS)
    } catch {
      return null
    }
  }, [amountStr])
  const balanceRefreshKey = `${balances.evm?.toString() ?? ''}:${balances.hc?.toString() ?? ''}`

  const quoteRequestId = useRef(0)
  const [manualSource, setManualSource] = useState<SourceChain | null>(null)

  useEffect(() => {
    // Balance changes can flip the auto route from HyperEVM bridge to direct
    // HyperCore swap after a deposit credits.
    void balanceRefreshKey
    const requestId = ++quoteRequestId.current
    setQuote(null)
    setRoute(null)
    if (!kit || onWrongChain) {
      setIsQuoting(false)
      return
    }
    if (parsedAmount === null || parsedAmount <= 0n) {
      setIsQuoting(false)
      return
    }
    const timer = setTimeout(async () => {
      setError(null)
      setIsQuoting(true)
      try {
        const nextRoute = await kit.preflightSwap({
          from: 'USDC',
          amount: parsedAmount,
          slippageBps,
          sourceChain:
            manualSource === 'hc' ? 'hypercore' : manualSource === 'evm' ? 'hyperevm' : 'auto',
        })
        if (requestId !== quoteRequestId.current) return
        setRoute(nextRoute)
        setQuote(nextRoute.quote)
      } catch (err) {
        if (requestId !== quoteRequestId.current) return
        setError(friendlyError(err))
      } finally {
        if (requestId === quoteRequestId.current) setIsQuoting(false)
      }
    }, QUOTE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [kit, parsedAmount, slippageBps, manualSource, onWrongChain, balanceRefreshKey])

  useEffect(() => {
    setReadOnlyEstimate(null)
    if (isConnected || onWrongChain || parsedAmount === null || parsedAmount <= 0n) {
      setIsReadOnlyQuoting(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setIsReadOnlyQuoting(true)
      try {
        const info = createInfoClient({ network, timeoutMs: READ_ONLY_QUOTE_TIMEOUT_MS })
        const pairs = listUsdhSpotPairs(await info.spotMeta())
        const pair =
          pairs.find((candidate) => candidate.base === 'USDH' && candidate.quote === 'USDC') ??
          pairs[0]
        if (!pair) return
        const book = await info.l2Book(pair.name)
        const ask = book.levels[1]?.[0]?.px
        if (!ask) return
        const askPrice18 = parseUnits(ask, PRICE_DECIMALS)
        if (askPrice18 <= 0n) return
        const nextEstimate = (parsedAmount * 10n ** BigInt(PRICE_DECIMALS)) / askPrice18
        if (!cancelled) setReadOnlyEstimate(nextEstimate)
      } catch {
        if (!cancelled) setReadOnlyEstimate(null)
      } finally {
        if (!cancelled) setIsReadOnlyQuoting(false)
      }
    }, QUOTE_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isConnected, network, onWrongChain, parsedAmount])

  const hcCovers = route?.sourceChain === 'hypercore' && route.canSwap

  const evmCovers =
    parsedAmount !== null &&
    parsedAmount > 0n &&
    balances.evm !== undefined &&
    balances.evmDecimals !== undefined &&
    scaleAmount(parsedAmount, balances.evmDecimals - USDC_DECIMALS) <= balances.evm

  // Default routing: if HC has enough, swap direct; otherwise bridge from EVM.
  // The user can override via the source-chain pill.
  // Hold on the conservative default ("evm", bridge required) until both
  // balances are loaded — otherwise the pill flips out from under the user
  // when the HC query resolves a tick after the EVM query.
  const autoSource: SourceChain = route?.sourceChain === 'hypercore' ? 'hc' : 'evm'
  const sourceChain = manualSource ?? autoSource

  const requiresBridge = sourceChain === 'evm'
  const belowMinOrderValue =
    parsedAmount !== null && parsedAmount > 0n && parsedAmount < MIN_SWAP_AMOUNT
  const insufficientForRoute =
    parsedAmount !== null &&
    parsedAmount > 0n &&
    !belowMinOrderValue &&
    ((sourceChain === 'hc' && route !== null && !hcCovers) ||
      (sourceChain === 'evm' && balances.evm !== undefined && !evmCovers))
  const activeRouteLoaded =
    sourceChain === 'hc'
      ? route !== null
      : balances.evm !== undefined && balances.evmDecimals !== undefined
  const activeRouteCovers = sourceChain === 'hc' ? hcCovers : evmCovers

  function reset() {
    setPhase('idle')
    setResult(null)
    setError(null)
  }

  function applySlippagePreset(bps: number) {
    setSlippageBps(bps)
    setShowCustomSlippage(false)
    setCustomSlippageStr('')
  }

  function applyCustomSlippage(input: string) {
    setCustomSlippageStr(input)
    const trimmed = input.trim()
    if (trimmed === '') return
    const pct = Number(trimmed)
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) return
    setSlippageBps(Math.round(pct * 100))
  }

  async function executeBridgeAndSwap() {
    if (!kit || parsedAmount === null || parsedAmount <= 0n) return
    // Hard guard against double-clicks: setPhase is async, so without this a
    // synchronous double-tap can dispatch two tx requests before the button's
    // disabled state commits.
    if (phase !== 'idle') return
    setError(null)
    setResult(null)

    if (!sessionReady) {
      setPhase('approving')
      try {
        await enableTradingSession()
      } catch (err) {
        setError(friendlyError(err))
      } finally {
        setPhase('idle')
      }
      return
    }

    let failurePrefix = ''
    try {
      const next = await kit.bridgeAndSwap({
        from: 'USDC',
        amount: parsedAmount,
        slippageBps,
        sourceChain:
          manualSource === 'hc' ? 'hypercore' : manualSource === 'evm' ? 'hyperevm' : 'auto',
        onProgress: (event) => {
          setRoute(event.route)
          setQuote(event.route.quote)
          if (event.phase === 'bridging' || event.phase === 'swapping') {
            failurePrefix = event.phase === 'bridging' ? 'Bridge failed: ' : 'Swap failed: '
            setPhase(event.phase)
            if (event.phase === 'bridging') setBridgeStartedAt(Date.now())
          }
        },
      })
      const payload: SwapResultPayload = {
        orderId: next.swap.orderId,
        receivedUsdh: next.swap.received,
        ...(next.bridge?.txHash !== undefined && { txHash: next.bridge.txHash }),
      }
      setResult(payload)
      setPhase('done')
      setRoute(null)
      setQuote(null)
      balances.refetch()
      window.setTimeout(() => balances.refetch(), 2_500)
      onSwapComplete?.(payload)
    } catch (err) {
      const bridgeTimeout = isBridgeTimeoutError(err)
      setError(bridgeTimeout ? friendlyError(err) : `${failurePrefix}${friendlyError(err)}`)
      if (bridgeTimeout) {
        setRoute(null)
        setQuote(null)
        balances.refetch()
        window.setTimeout(() => balances.refetch(), 5_000)
        window.setTimeout(() => balances.refetch(), 15_000)
      }
      setPhase('idle')
    }
  }

  const inputDisabled = busy || onWrongChain || showingResult
  const canSwap =
    !busy &&
    !showingResult &&
    !onWrongChain &&
    isConnected &&
    kit !== null &&
    !isApprovingSession &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    !belowMinOrderValue &&
    activeRouteLoaded &&
    activeRouteCovers

  // Display the receive amount: while no quote is in, mirror the input
  // (USDH is a USD-pegged stable so 1:1 is the honest user-facing default).
  // When a quote arrives, show the rounded estimate. We never show drift bps
  // in the headline — the slippage tolerance is the user-facing knob.
  const receiveDisplay = quote
    ? trimReceive(quote.estimatedReceived, USDC_DECIMALS)
    : readOnlyEstimate !== null
      ? trimReceive(readOnlyEstimate, USDC_DECIMALS)
      : parsedAmount && parsedAmount > 0n
        ? trimReceive(parsedAmount, USDC_DECIMALS)
        : '0'

  const payUsdValue = parsedAmount ? formatUsd(parsedAmount, USDC_DECIMALS) : null
  const receiveBigint = quote
    ? quote.estimatedReceived
    : readOnlyEstimate !== null
      ? readOnlyEstimate
      : parsedAmount && parsedAmount > 0n
        ? parsedAmount
        : null
  const receiveUsdValue = receiveBigint ? formatUsd(receiveBigint, USDC_DECIMALS) : null

  // Active source drives the MAX button.
  const activeBalance = sourceChain === 'evm' ? balances.evm : balances.hc
  const activeDecimals = sourceChain === 'evm' ? balances.evmDecimals : balances.hcDecimals

  function setMaxAmount() {
    if (activeBalance === undefined || activeDecimals === undefined) return
    // Inverse of scaleAmount: pull native units back to USDC display units.
    const usdcAmount = scaleAmount(activeBalance, USDC_DECIMALS - activeDecimals)
    setAmountStr(formatUnits(usdcAmount, USDC_DECIMALS))
  }

  const hasMaxBalance =
    activeBalance !== undefined && activeDecimals !== undefined && activeBalance > 0n
  const bridgeElapsedSeconds =
    phase === 'bridging' && bridgeStartedAt !== null
      ? Math.max(0, Math.floor((nowMs - bridgeStartedAt) / 1_000))
      : 0

  function toggleSourceChain() {
    setManualSource(sourceChain === 'evm' ? 'hc' : 'evm')
  }

  const showInlineNote =
    isConnected && requiresBridge && parsedAmount !== null && parsedAmount > 0n && phase === 'idle'

  return (
    <div
      data-theme={effectiveTheme}
      className={`usdh-widget mx-auto min-w-0 w-full rounded-2xl border border-usdh-border bg-usdh-bg/70 p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset] backdrop-blur ${effectiveTheme === 'dark' ? 'dark' : ''}`}
      style={{ maxWidth: 'min(480px, calc(100vw - 2rem))' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-usdh-text">Swap to USDH</h3>
        {!hideNetworkToggle && (
          <NetworkToggle network={network} onChange={setNetwork} disabled={networkToggleLocked} />
        )}
      </div>

      {onWrongChain && (
        <WrongNetworkBanner
          onSwitch={() => switchChain({ chainId: expectedChainId })}
          isSwitching={isSwitching}
        />
      )}

      {isConnected && <BalanceRow balances={balances} sourceChain={sourceChain} />}

      <div className="mt-3">
        <PayCard
          amountStr={amountStr}
          onAmountChange={setAmountStr}
          inputDisabled={inputDisabled}
          sourceChain={sourceChain}
          onSourceToggle={toggleSourceChain}
          payUsdValue={payUsdValue}
          hasMaxBalance={hasMaxBalance}
          onMax={setMaxAmount}
        />
        <ArrowDivider />
        <ReceiveCard
          receiveDisplay={receiveDisplay}
          receiveUsdValue={receiveUsdValue}
          isQuoting={isQuoting || isReadOnlyQuoting}
          hasQuote={quote !== null || readOnlyEstimate !== null}
        />
      </div>

      {!showingResult && (
        <>
          {insufficientForRoute && (
            <p className="mt-2 text-[11px] text-usdh-text-soft">
              Exceeds your {sourceChain === 'evm' ? 'HyperEVM' : 'HyperCore'} USDC balance.
            </p>
          )}
          {belowMinOrderValue && (
            <p className="mt-2 text-[11px] text-usdh-text-soft">
              Hyperliquid spot orders need more than 10 USDC. Use {MIN_SWAP_DISPLAY}+ USDC.
            </p>
          )}

          <SlippageRow
            slippageBps={slippageBps}
            onPreset={applySlippagePreset}
            showCustom={showCustomSlippage}
            onToggleCustom={() => setShowCustomSlippage((v) => !v)}
            customStr={customSlippageStr}
            onCustomChange={applyCustomSlippage}
            disabled={inputDisabled}
          />

          <ActionButton
            phase={phase}
            insufficient={insufficientForRoute}
            belowMinOrderValue={belowMinOrderValue}
            isConnected={isConnected}
            requiresBridge={requiresBridge}
            sourceChain={sourceChain}
            needsTradingSession={!sessionReady}
            disabled={!canSwap}
            onClick={executeBridgeAndSwap}
          />

          {phase === 'bridging' && (
            <p className="mt-2 text-center text-[11px] leading-snug text-usdh-text-faint">
              Bridging usually credits in about 1-2 minutes. Checking HyperCore credit for{' '}
              <span className="font-mono text-usdh-text-soft">{bridgeElapsedSeconds}s</span>.
            </p>
          )}
          {showInlineNote && <InlineSystemAddressNote />}
        </>
      )}
      {error && <ErrorAlert message={error} />}
      {result && <ResultPanel result={result} onReset={reset} />}

      {!hideAttribution && (
        <div className="mt-3 border-t border-usdh-border pt-2.5">
          <Watermark />
        </div>
      )}
    </div>
  )
}

function isBridgeTimeoutError(err: unknown): boolean {
  if (err instanceof BridgeTimeoutError) return true
  if (isBridgeAndSwapError(err)) {
    return err.cause instanceof BridgeTimeoutError
  }
  return false
}
