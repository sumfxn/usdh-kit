'use client'

import { createInfoClient, listUsdhSpotPairs } from '@usdh-kit/sdk'
import type { Quote, SwapRoute } from '@usdh-kit/sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount } from 'wagmi'

import { ActionButton } from './components/action-button.js'
import { ArrowDivider } from './components/arrow-divider.js'
import { ErrorAlert } from './components/error-alert.js'
import { NetworkToggle } from './components/network-toggle.js'
import { PayCard } from './components/pay-card.js'
import { ReceiveCard } from './components/receive-card.js'
import { ResultPanel } from './components/result-panel.js'
import { SlippageRow } from './components/slippage-row.js'
import { formatBalance, formatUsd, scaleAmount, trimReceive } from './format-display.js'
import { formatUnits, parseUnits } from './format.js'
import { friendlyError } from './friendly-error.js'
import type { HyperNetwork, USDHMigrationResultPayload, WidgetTheme } from './types.js'
import { useAgentWalletKit } from './use-agent-wallet-kit.js'
import { useUsdcBalances } from './use-balances.js'
import { useCountdown } from './use-countdown.js'
import { useEffectiveTheme } from './use-theme.js'
import { Watermark } from './watermark.js'

const USDH_DECIMALS = 6
const MIN_SWAP_AMOUNT = 10_000_001n
const MIN_SWAP_DISPLAY = '11'
const QUOTE_DEBOUNCE_MS = 400
const READ_ONLY_QUOTE_TIMEOUT_MS = 1_500
const PRICE_DECIMALS = 18
const TEN_18 = 10n ** BigInt(PRICE_DECIMALS)

type BidDepthEstimate = {
  receivedUsdc: bigint
  spentUsdh: bigint
  fullyCovered: boolean
}

// USDH -> USDC is HyperCore-only and never bridges, so the migration widget
// has a strictly simpler lifecycle than USDHSwap (no `bridging` phase).
type Phase = 'idle' | 'approving' | 'swapping' | 'done'

export type USDHMigrationProps = {
  /** HyperEVM network the migration targets. */
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
  /** Called when a migration fills successfully. */
  onMigrationComplete?: (result: USDHMigrationResultPayload) => void
}

/**
 * Exit widget: convert a USDH HyperCore balance back to USDC. This is the
 * reverse of `USDHSwap`: USDH is being sunset on Hyperliquid in favour of
 * USDC, and this tool helps users migrate out. HyperCore sell side only:
 * no bridging, no HyperEVM source, no source-chain toggle.
 */
export function USDHMigration(props: USDHMigrationProps) {
  const {
    network: initialNetwork,
    hideNetworkToggle = false,
    hideAttribution = false,
    theme = 'auto',
    defaultSlippageBps = 30,
    defaultAmount = '11',
    onMigrationComplete,
  } = props

  const effectiveTheme = useEffectiveTheme(theme)
  const [network, setNetwork] = useState<HyperNetwork>(initialNetwork)
  const { address, isConnected } = useAccount()
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
  const [readOnlyQuoteUnavailable, setReadOnlyQuoteUnavailable] = useState(false)
  const [isReadOnlyQuoting, setIsReadOnlyQuoting] = useState(false)
  const [depthWarning, setDepthWarning] = useState<string | null>(null)
  const [knownDepthLimited, setKnownDepthLimited] = useState(false)
  const [result, setResult] = useState<USDHMigrationResultPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const quoteExpirySeconds = useCountdown(quote?.validUntil ?? null)

  const busy = phase === 'approving' || phase === 'swapping'
  const showingResult = phase === 'done' && result !== null
  const networkToggleLocked = busy

  useEffect(() => {
    if (!networkToggleLocked) setNetwork(initialNetwork)
  }, [initialNetwork, networkToggleLocked])

  useEffect(() => {
    if (quote && quoteExpirySeconds === 0) setQuote(null)
  }, [quote, quoteExpirySeconds])

  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amountStr || '0', USDH_DECIMALS)
    } catch {
      return null
    }
  }, [amountStr])
  const balanceRefreshKey = balances.hcUsdh?.toString() ?? ''

  const quoteRequestId = useRef(0)

  useEffect(() => {
    // A USDH deposit crediting after mount can flip the route from blocked to
    // coverable, so re-quote when the HyperCore USDH balance changes.
    void balanceRefreshKey
    const requestId = ++quoteRequestId.current
    setQuote(null)
    setRoute(null)
    setDepthWarning(null)
    setKnownDepthLimited(false)
    if (!kit) {
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
        // USDH -> USDC: sell side, HyperCore only. preflightSwap returns the
        // quote plus the HyperCore balance coverage we gate the button on.
        const nextRoute = await kit.preflightSwap({
          from: 'USDH',
          to: 'USDC',
          amount: parsedAmount,
          slippageBps,
          sourceChain: 'hypercore',
        })
        if (requestId !== quoteRequestId.current) return
        let nextQuote = nextRoute.quote
        try {
          const book = await kit.getBook(nextRoute.quote.pair)
          if (requestId !== quoteRequestId.current) return
          const depth = estimateUsdcFromBidDepth(book.levels[0], parsedAmount)
          if (depth === null || depth.spentUsdh === 0n) {
            setKnownDepthLimited(true)
            setDepthWarning('No visible USDH/USDC bid depth for this amount.')
          } else if (!depth.fullyCovered) {
            setKnownDepthLimited(true)
            setDepthWarning(
              `Visible bid depth covers ${trimReceive(depth.spentUsdh, USDH_DECIMALS)} of ${trimReceive(parsedAmount, USDH_DECIMALS)} USDH. Reduce the amount or refresh before migrating.`,
            )
          } else {
            setKnownDepthLimited(false)
            setDepthWarning(null)
            nextQuote = { ...nextRoute.quote, estimatedReceived: depth.receivedUsdc }
          }
        } catch {
          setKnownDepthLimited(true)
          setDepthWarning('Unable to verify visible USDH/USDC bid depth. Refresh before migrating.')
        }
        setRoute({ ...nextRoute, quote: nextQuote })
        setQuote(nextQuote)
      } catch (err) {
        if (requestId !== quoteRequestId.current) return
        setError(friendlyError(err))
      } finally {
        if (requestId === quoteRequestId.current) setIsQuoting(false)
      }
    }, QUOTE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [kit, parsedAmount, slippageBps, balanceRefreshKey])

  useEffect(() => {
    setReadOnlyEstimate(null)
    setReadOnlyQuoteUnavailable(false)
    setDepthWarning(null)
    setKnownDepthLimited(false)
    if (isConnected || parsedAmount === null || parsedAmount <= 0n) {
      setIsReadOnlyQuoting(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setIsReadOnlyQuoting(true)
      try {
        const info = createInfoClient({ network, timeoutMs: READ_ONLY_QUOTE_TIMEOUT_MS })
        const pairs = listUsdhSpotPairs(await info.spotMeta())
        const pair = pairs.find(
          (candidate) => candidate.base === 'USDH' && candidate.quote === 'USDC',
        )
        if (!pair) {
          if (!cancelled) setReadOnlyQuoteUnavailable(true)
          return
        }
        const book = await info.l2Book(pair.name)
        const depth = estimateUsdcFromBidDepth(book.levels[0], parsedAmount)
        if (depth === null || depth.spentUsdh === 0n) {
          if (!cancelled) setReadOnlyQuoteUnavailable(true)
          return
        }
        if (!depth.fullyCovered) {
          if (!cancelled) {
            setReadOnlyQuoteUnavailable(true)
            setDepthWarning(
              `Visible bid depth covers ${trimReceive(depth.spentUsdh, USDH_DECIMALS)} of ${trimReceive(parsedAmount, USDH_DECIMALS)} USDH.`,
            )
          }
          return
        }
        if (!cancelled) {
          setReadOnlyEstimate(depth.receivedUsdc)
          setReadOnlyQuoteUnavailable(false)
          setDepthWarning(null)
        }
      } catch {
        if (!cancelled) {
          setReadOnlyEstimate(null)
          setReadOnlyQuoteUnavailable(true)
        }
      } finally {
        if (!cancelled) setIsReadOnlyQuoting(false)
      }
    }, QUOTE_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isConnected, network, parsedAmount])

  const belowMinOrderValue =
    parsedAmount !== null && parsedAmount > 0n && parsedAmount < MIN_SWAP_AMOUNT
  const hcCovers = route?.canSwap ?? false
  const insufficientForRoute =
    parsedAmount !== null && parsedAmount > 0n && !belowMinOrderValue && route !== null && !hcCovers
  const routeLoaded = route !== null

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

  async function executeMigration() {
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

    setPhase('swapping')
    try {
      const next = await kit.swap({
        from: 'USDH',
        to: 'USDC',
        amount: parsedAmount,
        slippageBps,
      })
      const payload: USDHMigrationResultPayload = {
        orderId: next.orderId,
        spentUsdh: next.spent,
        receivedUsdc: next.received,
        price: next.price,
        slippageBps: next.slippageBps,
      }
      setResult(payload)
      setPhase('done')
      setRoute(null)
      setQuote(null)
      balances.refetch()
      window.setTimeout(() => balances.refetch(), 2_500)
      onMigrationComplete?.(payload)
    } catch (err) {
      setError(friendlyError(err))
      setPhase('idle')
    }
  }

  const inputDisabled = busy || showingResult
  const canSwap =
    !busy &&
    !showingResult &&
    isConnected &&
    kit !== null &&
    !isApprovingSession &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    !belowMinOrderValue &&
    routeLoaded &&
    hcCovers &&
    !knownDepthLimited

  const receiveDisplay = quote
    ? trimReceive(quote.estimatedReceived, USDH_DECIMALS)
    : readOnlyEstimate !== null
      ? trimReceive(readOnlyEstimate, USDH_DECIMALS)
      : readOnlyQuoteUnavailable
        ? 'Quote unavailable'
        : '0'

  const payUsdValue = parsedAmount ? formatUsd(parsedAmount, USDH_DECIMALS) : null
  const receiveBigint = quote
    ? quote.estimatedReceived
    : readOnlyEstimate !== null
      ? readOnlyEstimate
      : null
  const receiveUsdValue = receiveBigint ? formatUsd(receiveBigint, USDH_DECIMALS) : null

  function setMaxAmount() {
    if (balances.hcUsdh === undefined || balances.hcUsdhDecimals === undefined) return
    // Inverse of scaleAmount: pull native units back to USDH display units.
    const usdhAmount = scaleAmount(balances.hcUsdh, USDH_DECIMALS - balances.hcUsdhDecimals)
    setAmountStr(formatUnits(usdhAmount, USDH_DECIMALS))
  }

  const hasMaxBalance =
    balances.hcUsdh !== undefined && balances.hcUsdhDecimals !== undefined && balances.hcUsdh > 0n

  return (
    <div
      data-theme={effectiveTheme}
      className={`usdh-widget mx-auto min-w-0 w-full rounded-2xl border border-usdh-border bg-usdh-bg/70 p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset] backdrop-blur ${effectiveTheme === 'dark' ? 'dark' : ''}`}
      style={{ maxWidth: 'min(480px, calc(100vw - 2rem))' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-usdh-text">Migrate USDH to USDC</h3>
        {!hideNetworkToggle && (
          <NetworkToggle network={network} onChange={setNetwork} disabled={networkToggleLocked} />
        )}
      </div>

      <p className="mt-2 rounded-lg border border-usdh-border bg-usdh-surface/60 px-3 py-2 text-[11px] leading-snug text-usdh-text-soft">
        USDH is being sunset on Hyperliquid. This converts your HyperCore USDH balance back to USDC.
      </p>
      {isConnected && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-usdh-border/70 bg-usdh-surface/40 px-3 py-2 text-[11px] text-usdh-text-soft">
          <span>HyperCore USDH balance</span>
          <span>
            <span className="font-mono tabular-nums text-usdh-text">
              {formatBalance(balances.hcUsdh, balances.hcUsdhDecimals)}
            </span>{' '}
            USDH
          </span>
        </div>
      )}

      <div className="mt-3">
        <PayCard
          amountStr={amountStr}
          onAmountChange={setAmountStr}
          inputDisabled={inputDisabled}
          payUsdValue={payUsdValue}
          hasMaxBalance={hasMaxBalance}
          onMax={setMaxAmount}
          payTicker="USDH"
        />
        <ArrowDivider />
        <ReceiveCard
          receiveDisplay={receiveDisplay}
          receiveUsdValue={receiveUsdValue}
          isQuoting={isQuoting || isReadOnlyQuoting}
          hasQuote={quote !== null || readOnlyEstimate !== null}
          receiveTicker="USDC"
        />
      </div>

      {!showingResult && (
        <>
          {depthWarning && (
            <p className="mt-2 text-[11px] leading-snug text-usdh-text-soft">{depthWarning}</p>
          )}
          {insufficientForRoute && (
            <p className="mt-2 text-[11px] text-usdh-text-soft">
              Exceeds your HyperCore USDH balance.
            </p>
          )}
          {belowMinOrderValue && (
            <p className="mt-2 text-[11px] text-usdh-text-soft">
              Hyperliquid spot orders need more than 10 USDH. Use {MIN_SWAP_DISPLAY}+ USDH.
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
            requiresBridge={false}
            sourceChain="hc"
            needsTradingSession={!sessionReady}
            disabled={!canSwap}
            onClick={executeMigration}
            payTicker="USDH"
            actionLabel="Migrate"
            connectLabel="Connect wallet to migrate"
            workingLabel="Migrating"
          />
        </>
      )}
      {error && <ErrorAlert message={error} />}
      {result && (
        <ResultPanel
          result={{
            orderId: result.orderId,
            receivedAmount: result.receivedUsdc,
            spentAmount: result.spentUsdh,
            ...(parsedAmount !== null && { requestedAmount: parsedAmount }),
          }}
          onReset={reset}
          receiveTicker="USDC"
          spentTicker="USDH"
          resetLabel="Migrate again"
        />
      )}

      {!hideAttribution && (
        <div className="mt-3 border-t border-usdh-border pt-2.5">
          <Watermark />
        </div>
      )}
    </div>
  )
}

function estimateUsdcFromBidDepth(
  bids: Array<{ px: string; sz: string }>,
  desiredUsdh: bigint,
): BidDepthEstimate | null {
  if (desiredUsdh <= 0n) return null
  let remainingUsdh = desiredUsdh
  let spentUsdh = 0n
  let receivedUsdc = 0n

  try {
    for (const level of bids) {
      if (remainingUsdh <= 0n) break
      const levelSizeUsdh = parseUnits(level.sz, USDH_DECIMALS)
      const bidPrice18 = parseUnits(level.px, PRICE_DECIMALS)
      if (levelSizeUsdh <= 0n || bidPrice18 <= 0n) continue
      const fillUsdh = levelSizeUsdh < remainingUsdh ? levelSizeUsdh : remainingUsdh
      spentUsdh += fillUsdh
      receivedUsdc += (fillUsdh * bidPrice18) / TEN_18
      remainingUsdh -= fillUsdh
    }
  } catch {
    return null
  }

  return {
    receivedUsdc,
    spentUsdh,
    fullyCovered: remainingUsdh === 0n,
  }
}
