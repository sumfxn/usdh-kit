'use client'

import type { Quote } from '@usdh-kit/sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'

import { HYPER_EVM_CHAIN_ID, networkLabel } from './chains.js'
import { formatUnits, parseUnits } from './format.js'
import { friendlyError } from './friendly-error.js'
import { ArrowDown, Spinner, SwitchHorizontal, UsdcIcon, UsdhIcon } from './icons.js'
import type { HyperNetwork, SwapResultPayload } from './types.js'
import { useUsdcBalances } from './use-balances.js'
import { useCountdown } from './use-countdown.js'
import { useUsdhKit } from './use-usdh-kit.js'
import { Watermark } from './watermark.js'

const USDC_DECIMALS = 6
const SLIPPAGE_PRESETS_BPS = [10, 30, 50, 100] as const
const QUOTE_DEBOUNCE_MS = 400
const RECEIVE_DECIMALS = 4
// Reserve over the user's slippage on top of the trade size so an HC-only
// swap doesn't reject post-confirm because the fill consumed a few extra bps
// of USDC for the spot taker fee. 10 bps covers the default-tier 7 bps fee
// with headroom.
const HC_FEE_BUFFER_BPS = 10n
const BPS_DENOMINATOR = 10_000n

type Phase = 'idle' | 'bridging' | 'swapping' | 'done'

export type USDHSwapProps = {
  /** HyperEVM network the swap targets. Defaults to `mainnet`. */
  network?: HyperNetwork
  /** Hide the in-widget testnet/mainnet toggle. Defaults to false. */
  hideNetworkToggle?: boolean
  /** Hide the "Powered by usdh-kit" footer. Defaults to false. */
  hideAttribution?: boolean
  /** Default slippage in basis points (10 = 0.10%). Defaults to 30. */
  defaultSlippageBps?: number
  /** Pre-fill the pay amount as a decimal string. */
  defaultAmount?: string
  /** Called when a swap fills successfully. */
  onSwapComplete?: (result: SwapResultPayload) => void
}

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

function scaleAmount(amount: bigint, decimalsDiff: number): bigint {
  if (decimalsDiff === 0) return amount
  if (decimalsDiff > 0) return amount * 10n ** BigInt(decimalsDiff)
  return amount / 10n ** BigInt(-decimalsDiff)
}

function trimReceive(amount: bigint, fromDecimals: number): string {
  const formatted = formatUnits(amount, fromDecimals)
  const dot = formatted.indexOf('.')
  if (dot === -1) return formatted
  const cap = Math.min(formatted.length, dot + 1 + RECEIVE_DECIMALS)
  return formatted.slice(0, cap).replace(/\.?0+$/, (m) => (m === '.' ? '' : m))
}

export function USDHSwap(props: USDHSwapProps) {
  const {
    network: initialNetwork = 'mainnet',
    hideNetworkToggle = false,
    hideAttribution = false,
    defaultSlippageBps = 30,
    defaultAmount = '1',
    onSwapComplete,
  } = props

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
  const [isQuoting, setIsQuoting] = useState(false)
  const [result, setResult] = useState<SwapResultPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const expectedChainId = HYPER_EVM_CHAIN_ID[network]
  const onWrongChain = isConnected && chainId !== expectedChainId

  const quoteExpirySeconds = useCountdown(quote?.validUntil ?? null)

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

  useEffect(() => {
    if (!kit) return
    if (onWrongChain) return
    if (parsedAmount === null || parsedAmount <= 0n) {
      setQuote(null)
      return
    }
    const requestId = ++quoteRequestId.current
    const timer = setTimeout(async () => {
      setError(null)
      setIsQuoting(true)
      try {
        const q = await kit.getQuote({ from: 'USDC', amount: parsedAmount })
        if (requestId !== quoteRequestId.current) return
        setQuote(q)
      } catch (err) {
        if (requestId !== quoteRequestId.current) return
        setError(friendlyError(err))
      } finally {
        if (requestId === quoteRequestId.current) setIsQuoting(false)
      }
    }, QUOTE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [kit, parsedAmount, onWrongChain])

  // Required HC balance to swap directly on HyperCore: nominal amount plus a
  // slippage + fee buffer so the IOC fill doesn't reject for a dust shortfall.
  const requiredHcUsdc =
    parsedAmount !== null && parsedAmount > 0n
      ? parsedAmount + (parsedAmount * (BigInt(slippageBps) + HC_FEE_BUFFER_BPS)) / BPS_DENOMINATOR
      : null

  const hcCovers =
    requiredHcUsdc !== null &&
    balances.hc !== undefined &&
    balances.hcDecimals !== undefined &&
    scaleAmount(requiredHcUsdc, balances.hcDecimals - USDC_DECIMALS) <= balances.hc

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
  const balancesLoaded = balances.hc !== undefined && balances.evm !== undefined
  const autoSource: 'evm' | 'hc' = balancesLoaded && hcCovers ? 'hc' : 'evm'
  const [manualSource, setManualSource] = useState<'evm' | 'hc' | null>(null)
  const sourceChain = manualSource ?? autoSource

  const requiresBridge = sourceChain === 'evm'
  const insufficientForRoute =
    parsedAmount !== null &&
    parsedAmount > 0n &&
    ((sourceChain === 'hc' && balances.hc !== undefined && !hcCovers) ||
      (sourceChain === 'evm' && balances.evm !== undefined && !evmCovers))

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
    // synchronous double-tap can dispatch two bridge tx requests before the
    // button's disabled state commits.
    if (phase !== 'idle') return
    setError(null)
    setResult(null)
    let txHash: `0x${string}` | undefined
    if (requiresBridge) {
      setPhase('bridging')
      try {
        const bridge = await kit.bridgeToCore({ asset: 'USDC', amount: parsedAmount })
        txHash = bridge.txHash
      } catch (err) {
        setError(`Bridge failed: ${friendlyError(err)}`)
        setPhase('idle')
        return
      }
    }
    setPhase('swapping')
    try {
      const swap = await kit.swap({ from: 'USDC', amount: parsedAmount, slippageBps })
      const payload: SwapResultPayload = {
        orderId: swap.orderId,
        receivedUsdh: swap.received,
        ...(txHash !== undefined && { txHash }),
      }
      setResult(payload)
      setPhase('done')
      balances.refetch()
      onSwapComplete?.(payload)
    } catch (err) {
      setError(`Swap failed: ${friendlyError(err)}`)
      setPhase('idle')
    }
  }

  const busy = phase === 'bridging' || phase === 'swapping'
  const inputDisabled = busy || onWrongChain
  const networkToggleLocked = busy
  const canSwap =
    !busy &&
    !onWrongChain &&
    isConnected &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    !insufficientForRoute

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

  // Active source drives the balance line + MAX button.
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

  return (
    <div className="usdh-widget mx-auto w-full max-w-[480px] rounded-2xl border border-neutral-800/80 bg-neutral-950/70 p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset] backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-200">Swap to USDH</h3>
        {!hideNetworkToggle && (
          <div className="inline-flex rounded-md border border-neutral-800 p-0.5 text-[10px] uppercase tracking-wider">
            {(['testnet', 'mainnet'] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(n)}
                aria-pressed={network === n}
                disabled={networkToggleLocked}
                className={`rounded px-2 py-1 transition ${
                  network === n
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {n === 'mainnet' ? 'Mainnet' : 'Testnet'}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isConnected ? (
        <p className="mt-6 rounded-xl border border-neutral-800/60 bg-neutral-950/50 p-5 text-center text-xs text-neutral-500">
          Connect a wallet on {networkLabel(network)} to continue.
        </p>
      ) : (
        <>
          {onWrongChain && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs">
              <span className="text-neutral-300">Wrong network</span>
              <button
                type="button"
                onClick={() => switchChain({ chainId: expectedChainId })}
                disabled={isSwitching}
                className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
              >
                {isSwitching && <Spinner />}
                Switch
              </button>
            </div>
          )}

          <div className="mt-4">
            <div className="rounded-xl border border-neutral-800/70 bg-neutral-900/40 p-4">
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
                <span>You pay</span>
                <button
                  type="button"
                  onClick={toggleSourceChain}
                  disabled={inputDisabled}
                  aria-label={`Source chain: ${sourceChain === 'evm' ? 'HyperEVM' : 'HyperCore'}. Click to switch.`}
                  className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400 transition hover:bg-neutral-800/60 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>from {sourceChain === 'evm' ? 'HyperEVM' : 'HyperCore'}</span>
                  <SwitchHorizontal className="text-neutral-600 transition group-hover:text-neutral-300" />
                </button>
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  disabled={inputDisabled}
                  aria-label="Amount in USDC"
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent font-sans text-4xl font-light tracking-tight text-neutral-100 outline-none placeholder:text-neutral-700 disabled:opacity-60"
                />
                <TokenChip icon={<UsdcIcon />} ticker="USDC" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-neutral-500">
                <span className="min-w-0 truncate">
                  {payUsdValue && <span className="text-neutral-500">{payUsdValue}</span>}
                  {balancesLoaded && (
                    <span className="ml-2">
                      <span className="text-neutral-600">EVM </span>
                      <span
                        className={`font-mono ${sourceChain === 'evm' ? 'text-neutral-200' : 'text-neutral-600'}`}
                      >
                        {formatBalance(balances.evm, balances.evmDecimals)}
                      </span>
                      <span className="mx-1.5 text-neutral-700">·</span>
                      <span className="text-neutral-600">HC </span>
                      <span
                        className={`font-mono ${sourceChain === 'hc' ? 'text-neutral-200' : 'text-neutral-600'}`}
                      >
                        {formatBalance(balances.hc, balances.hcDecimals)}
                      </span>
                    </span>
                  )}
                </span>
                {hasMaxBalance && (
                  <button
                    type="button"
                    onClick={setMaxAmount}
                    disabled={inputDisabled}
                    className="shrink-0 rounded border border-neutral-800 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-50"
                  >
                    Max
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center py-1.5" aria-hidden="true">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-800/80 bg-neutral-900/40 text-neutral-500">
                <ArrowDown />
              </span>
            </div>

            <div className="rounded-xl border border-neutral-800/70 bg-neutral-900/40 p-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500">
                <span>You receive</span>
                <span className="font-mono text-neutral-500">on HyperCore</span>
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-sans text-4xl font-light tracking-tight text-neutral-100">
                  {isQuoting && !quote ? <Spinner className="h-5 w-5" /> : receiveDisplay}
                </span>
                <TokenChip icon={<UsdhIcon />} ticker="USDH" />
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">{receiveUsdValue ?? ' '}</p>
            </div>
          </div>

          {insufficientForRoute && (
            <p className="mt-2 text-[11px] text-neutral-500">
              Exceeds your {sourceChain === 'evm' ? 'HyperEVM' : 'HyperCore'} USDC balance.
            </p>
          )}

          <div className="mt-4">
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-neutral-500">Slippage</p>
            <div className="flex flex-wrap items-center gap-1">
              {SLIPPAGE_PRESETS_BPS.map((bps) => {
                const active = slippageBps === bps && !showCustomSlippage
                return (
                  <button
                    key={bps}
                    type="button"
                    onClick={() => applySlippagePreset(bps)}
                    aria-pressed={active}
                    disabled={inputDisabled}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                      active
                        ? 'border-neutral-200 bg-neutral-100 text-neutral-900'
                        : 'border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    {bpsToPercent(bps)}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setShowCustomSlippage((v) => !v)}
                aria-pressed={showCustomSlippage}
                disabled={inputDisabled}
                className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                  showCustomSlippage
                    ? 'border-neutral-200 bg-neutral-100 text-neutral-900'
                    : 'border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                Custom
              </button>
              {showCustomSlippage && (
                <div className="flex items-center gap-1 rounded-md border border-neutral-800 px-2 py-1 font-mono text-[11px]">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customSlippageStr}
                    onChange={(e) => applyCustomSlippage(e.target.value)}
                    placeholder="0.30"
                    aria-label="Custom slippage percent"
                    className="w-10 bg-transparent text-neutral-100 outline-none placeholder:text-neutral-700"
                  />
                  <span className="text-neutral-500">%</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={executeBridgeAndSwap}
            disabled={!canSwap}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === 'bridging' ? (
              <>
                <Spinner /> Bridging
              </>
            ) : phase === 'swapping' ? (
              <>
                <Spinner /> Swapping
              </>
            ) : insufficientForRoute ? (
              `Insufficient ${sourceChain === 'evm' ? 'HyperEVM' : 'HyperCore'} USDC`
            ) : requiresBridge ? (
              'Bridge and swap'
            ) : (
              'Swap'
            )}
          </button>

          {requiresBridge && parsedAmount !== null && parsedAmount > 0n && phase === 'idle' && (
            <p className="mt-2 text-center text-[10px] leading-relaxed text-neutral-600">
              Your wallet will request a transfer to{' '}
              <span className="font-mono text-neutral-500">0x2000…0000</span> — Hyperliquid's USDC
              system address.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-[11px] text-neutral-200"
            >
              {error}
            </p>
          )}

          {result && (
            <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-200">Filled</span>
                <span className="font-mono text-neutral-100">
                  {trimReceive(result.receivedUsdh, USDC_DECIMALS)} USDH
                </span>
              </div>
              <p className="mt-1 text-[10px] text-neutral-500">
                order {result.orderId}
                {result.txHash && (
                  <>
                    {' · '}
                    <span className="font-mono">
                      {result.txHash.slice(0, 8)}…{result.txHash.slice(-6)}
                    </span>
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-2 text-[11px] text-neutral-400 underline hover:text-neutral-200"
              >
                Swap again
              </button>
            </div>
          )}
        </>
      )}

      {!hideAttribution && (
        <div className="mt-4 border-t border-neutral-900 pt-3">
          <Watermark />
        </div>
      )}
    </div>
  )
}

function TokenChip({ icon, ticker }: { icon: React.ReactNode; ticker: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-neutral-700/60 bg-neutral-900 py-1 pl-1 pr-3 font-medium text-sm text-neutral-100 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]">
      {icon}
      {ticker}
    </span>
  )
}

function formatBalance(amount: bigint | undefined, decimals: number | undefined): string {
  if (amount === undefined || decimals === undefined) return '—'
  if (amount === 0n) return '0'
  return trimReceive(amount, decimals)
}

/** USDC and USDH are USD-pegged stables, so the amount is the USD value at parity. */
function formatUsd(amount: bigint, decimals: number): string {
  const factor = 10n ** BigInt(decimals)
  const intPart = amount / factor
  const fracPart = amount % factor
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const cents = (fracPart * 100n) / factor
  return `≈ $${intStr}.${cents.toString().padStart(2, '0')}`
}
