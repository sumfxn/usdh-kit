'use client'

import type { Quote, SwapRoute } from '@usdh-kit/sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'

import { HYPER_EVM_CHAIN_ID, networkLabel } from './chains.js'
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
import { useUsdcBalances } from './use-balances.js'
import { useCountdown } from './use-countdown.js'
import { useEffectiveTheme } from './use-theme.js'
import { useUsdhKit } from './use-usdh-kit.js'
import { Watermark } from './watermark.js'

const USDC_DECIMALS = 6
const QUOTE_DEBOUNCE_MS = 400

declare const process: { env?: { NODE_ENV?: string } } | undefined

type Phase = 'idle' | 'bridging' | 'swapping' | 'done'

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
    defaultAmount = '1',
    onSwapComplete,
  } = props

  const effectiveTheme = useEffectiveTheme(theme)
  const [network, setNetwork] = useState<HyperNetwork>(initialNetwork)
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const kit = useUsdhKit(network)
  const balances = useUsdcBalances(network, address)

  const [amountStr, setAmountStr] = useState(defaultAmount)
  const [slippageBps, setSlippageBps] = useState(defaultSlippageBps)
  const [customSlippageStr, setCustomSlippageStr] = useState('')
  const [showCustomSlippage, setShowCustomSlippage] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [route, setRoute] = useState<SwapRoute | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)
  const [result, setResult] = useState<SwapResultPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const expectedChainId = HYPER_EVM_CHAIN_ID[network]
  const onWrongChain = isConnected && chainId !== expectedChainId

  const quoteExpirySeconds = useCountdown(quote?.validUntil ?? null)

  const busy = phase === 'bridging' || phase === 'swapping'
  const networkToggleLocked = busy

  useEffect(() => {
    if (!networkToggleLocked) setNetwork(initialNetwork)
  }, [initialNetwork, networkToggleLocked])

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

  const quoteRequestId = useRef(0)
  const [manualSource, setManualSource] = useState<SourceChain | null>(null)
  const balanceRefreshKey = `${balances.evm?.toString() ?? 'evm-unloaded'}:${
    balances.evmDecimals ?? 'evm-decimals-unloaded'
  }:${balances.hc?.toString() ?? 'hc-unloaded'}:${balances.hcDecimals ?? 'hc-decimals-unloaded'}`

  // biome-ignore lint/correctness/useExhaustiveDependencies: live balance changes must invalidate route/preflight because fresh HC deposits can change the selected source chain.
  useEffect(() => {
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
  const insufficientForRoute =
    parsedAmount !== null &&
    parsedAmount > 0n &&
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
      balances.refetch()
      onSwapComplete?.(payload)
    } catch (err) {
      logDevError('bridgeAndSwap', err)
      setError(`${failurePrefix}${friendlyError(err)}`)
      setPhase('idle')
    }
  }

  const inputDisabled = busy || onWrongChain
  const canSwap =
    !busy &&
    !onWrongChain &&
    isConnected &&
    kit !== null &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    activeRouteLoaded &&
    activeRouteCovers

  // Display the receive amount: while no quote is in, mirror the input
  // (USDH is a USD-pegged stable so 1:1 is the honest user-facing default).
  // When a quote arrives, show the rounded estimate. We never show drift bps
  // in the headline — the slippage tolerance is the user-facing knob.
  const receiveDisplay = quote
    ? trimReceive(quote.estimatedReceived, USDC_DECIMALS)
    : parsedAmount && parsedAmount > 0n
      ? trimReceive(parsedAmount, USDC_DECIMALS)
      : '0'

  const payUsdValue = parsedAmount ? formatUsd(parsedAmount, USDC_DECIMALS) : null
  const receiveBigint = quote
    ? quote.estimatedReceived
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

  function toggleSourceChain() {
    setManualSource(sourceChain === 'evm' ? 'hc' : 'evm')
  }

  const showInlineNote =
    requiresBridge && parsedAmount !== null && parsedAmount > 0n && phase === 'idle'

  return (
    <div
      data-theme={effectiveTheme}
      className={`usdh-widget mx-auto w-full max-w-[480px] rounded-2xl border border-usdh-border bg-usdh-bg/70 p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset] backdrop-blur ${effectiveTheme === 'dark' ? 'dark' : ''}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-usdh-text">Swap to USDH</h3>
        {!hideNetworkToggle && (
          <NetworkToggle network={network} onChange={setNetwork} disabled={networkToggleLocked} />
        )}
      </div>

      {!isConnected ? (
        <p className="mt-6 rounded-xl border border-usdh-border/60 bg-usdh-bg/50 p-5 text-center text-xs text-usdh-text-soft">
          Connect a wallet on {networkLabel(network)} to continue.
        </p>
      ) : (
        <>
          {onWrongChain && (
            <WrongNetworkBanner
              onSwitch={() => switchChain({ chainId: expectedChainId })}
              isSwitching={isSwitching}
            />
          )}

          <BalanceRow
            balances={balances}
            sourceChain={sourceChain}
            onRefresh={() => balances.refetch()}
          />

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
              isQuoting={isQuoting}
              hasQuote={quote !== null}
            />
          </div>

          {insufficientForRoute && (
            <p className="mt-2 text-[11px] text-usdh-text-soft">
              Exceeds your {sourceChain === 'evm' ? 'HyperEVM' : 'HyperCore'} USDC balance.
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
            requiresBridge={requiresBridge}
            sourceChain={sourceChain}
            disabled={!canSwap}
            onClick={executeBridgeAndSwap}
          />

          {showInlineNote && <InlineSystemAddressNote />}
          {error && <ErrorAlert message={error} />}
          {result && <ResultPanel result={result} onReset={reset} />}
        </>
      )}

      {!hideAttribution && (
        <div className="mt-3 border-t border-usdh-border pt-2.5">
          <Watermark />
        </div>
      )}
    </div>
  )
}

function logDevError(operation: string, err: unknown) {
  if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'development') return
  console.warn(`[usdh-kit] ${operation} failed`, summarizeError(err))
}

function summarizeError(err: unknown) {
  return {
    error: summarizeErrorShape(err),
    causeChain: summarizeCauseChain(err),
  }
}

function summarizeErrorShape(err: unknown) {
  if (!isObjectLike(err)) return { message: typeof err === 'string' ? firstLine(err) : undefined }
  const shape = err as { name?: unknown; code?: unknown; message?: unknown; phase?: unknown }
  return {
    name: typeof shape.name === 'string' ? shape.name : undefined,
    code: typeof shape.code === 'string' || typeof shape.code === 'number' ? shape.code : undefined,
    phase: typeof shape.phase === 'string' ? shape.phase : undefined,
    message: typeof shape.message === 'string' ? firstLine(shape.message) : undefined,
  }
}

function getCause(err: unknown): unknown {
  if (!isObjectLike(err)) return undefined
  return (err as { cause?: unknown }).cause
}

function summarizeCauseChain(err: unknown) {
  const chain: unknown[] = []
  let cursor = getCause(err)
  for (let depth = 0; cursor !== undefined && depth < 5; depth++) {
    chain.push(summarizeErrorShape(cursor))
    cursor = getCause(cursor)
  }
  return chain
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
}

function firstLine(message: string): string {
  const idx = message.indexOf('\n')
  return idx === -1 ? message : message.slice(0, idx)
}
