import { Spinner } from '../icons.js'
import type { SourceChain } from './source-chain-pill.js'

export type ActionPhase = 'idle' | 'approving' | 'bridging' | 'swapping' | 'done'

export function ActionButton(props: {
  phase: ActionPhase
  insufficient: boolean
  belowMinOrderValue: boolean
  isConnected: boolean
  requiresBridge: boolean
  sourceChain: SourceChain
  needsTradingSession: boolean
  disabled: boolean
  onClick: () => void
  /** Pay-side token ticker shown in balance/minimum labels. Defaults to `'USDC'`. */
  payTicker?: 'USDC' | 'USDH'
}) {
  const {
    phase,
    insufficient,
    belowMinOrderValue,
    isConnected,
    requiresBridge,
    sourceChain,
    needsTradingSession,
    disabled,
    onClick,
    payTicker = 'USDC',
  } = props
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-usdh-cta-bg px-4 py-2.5 text-sm font-medium text-usdh-cta-text transition hover:bg-usdh-cta-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
    >
      {phase === 'approving' ? (
        <>
          <Spinner /> Enabling session
        </>
      ) : phase === 'bridging' ? (
        <>
          <Spinner /> Bridging
        </>
      ) : phase === 'swapping' ? (
        <>
          <Spinner /> Swapping
        </>
      ) : insufficient ? (
        `Insufficient ${sourceChain === 'evm' ? 'HyperEVM' : 'HyperCore'} ${payTicker}`
      ) : belowMinOrderValue ? (
        `Minimum 11 ${payTicker}`
      ) : !isConnected ? (
        'Connect wallet to swap'
      ) : needsTradingSession ? (
        'Enable trading session'
      ) : requiresBridge ? (
        'Bridge and swap'
      ) : (
        'Swap'
      )}
    </button>
  )
}
