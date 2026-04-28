'use client'

import { useState } from 'react'
import type { Quote } from 'usdh-kit'
import { useAccount } from 'wagmi'

import type { HyperNetwork } from '../lib/chains'
import { formatUnits, parseUnits } from '../lib/format'
import { useUsdhKit } from '../lib/kit'

const USDC_DECIMALS = 6
type Phase = 'idle' | 'quoting' | 'bridging' | 'swapping' | 'done'

interface FillResult {
  txHash?: `0x${string}`
  orderId: string
  receivedUsdh: bigint
}

function Spinner() {
  return (
    <svg className="inline h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SwapPanel({ network }: { network: HyperNetwork }) {
  const { isConnected } = useAccount()
  const kit = useUsdhKit(network)

  const [amountStr, setAmountStr] = useState('1')
  const [phase, setPhase] = useState<Phase>('idle')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [result, setResult] = useState<FillResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isConnected || !kit) {
    return (
      <p className="text-sm text-neutral-500">
        Connect a wallet on HyperEVM {network === 'mainnet' ? 'Mainnet' : 'Testnet'} to swap.
      </p>
    )
  }

  function reset() {
    setPhase('idle')
    setQuote(null)
    setResult(null)
    setError(null)
  }

  async function getQuote() {
    if (!kit) return
    setError(null)
    setQuote(null)
    let amount: bigint
    try {
      amount = parseUnits(amountStr, USDC_DECIMALS)
    } catch (err) {
      setError(`Invalid amount: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    if (amount <= 0n) {
      setError('Amount must be greater than zero.')
      return
    }
    setPhase('quoting')
    try {
      const q = await kit.getQuote({ from: 'USDC', amount })
      setQuote(q)
      setPhase('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('idle')
    }
  }

  async function bridgeAndSwap() {
    if (!kit) return
    setError(null)
    setResult(null)
    let amount: bigint
    try {
      amount = parseUnits(amountStr, USDC_DECIMALS)
    } catch (err) {
      setError(`Invalid amount: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    setPhase('bridging')
    let txHash: `0x${string}` | undefined
    try {
      const bridge = await kit.bridgeToCore({ asset: 'USDC', amount })
      txHash = bridge.txHash
    } catch (err) {
      setError(`Bridge failed: ${err instanceof Error ? err.message : String(err)}`)
      setPhase('idle')
      return
    }
    setPhase('swapping')
    try {
      const swap = await kit.swap({ from: 'USDC', amount })
      setResult({
        orderId: swap.orderId,
        receivedUsdh: swap.received,
        ...(txHash !== undefined && { txHash }),
      })
      setPhase('done')
    } catch (err) {
      setError(`Swap failed: ${err instanceof Error ? err.message : String(err)}`)
      setPhase('idle')
    }
  }

  const busy = phase === 'quoting' || phase === 'bridging' || phase === 'swapping'

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="amount" className="block text-xs uppercase tracking-wide text-neutral-500">
          Amount (USDC)
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-lg text-neutral-100 outline-none focus:border-neutral-600 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={getQuote}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 px-4 py-3 text-sm font-medium hover:bg-neutral-900 disabled:opacity-50"
          >
            {phase === 'quoting' ? (
              <>
                <Spinner /> Quoting
              </>
            ) : (
              'Get quote'
            )}
          </button>
        </div>
      </div>

      {quote && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 text-sm">
          <p className="text-neutral-400">Estimated out</p>
          <p className="mt-1 font-mono text-lg text-neutral-100">
            {formatUnits(quote.estimatedReceived, USDC_DECIMALS)} USDH
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            pair {quote.pair} · midPrice {formatUnits(quote.midPrice, 18)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={bridgeAndSwap}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
      >
        {phase === 'bridging' ? (
          <>
            <Spinner /> Bridging to HyperCore
          </>
        ) : phase === 'swapping' ? (
          <>
            <Spinner /> Swapping
          </>
        ) : (
          'Bridge and swap'
        )}
      </button>

      {error && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-4 text-sm">
          <p className="text-emerald-300">Filled</p>
          <p className="mt-1 font-mono text-base text-neutral-100">
            {formatUnits(result.receivedUsdh, USDC_DECIMALS)} USDH
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            order {result.orderId}
            {result.txHash && (
              <>
                {' '}
                · bridge tx{' '}
                <span className="font-mono">
                  {result.txHash.slice(0, 10)}…{result.txHash.slice(-8)}
                </span>
              </>
            )}
          </p>
          <button type="button" onClick={reset} className="mt-3 text-xs text-neutral-400 underline">
            Swap again
          </button>
        </div>
      )}
    </div>
  )
}
