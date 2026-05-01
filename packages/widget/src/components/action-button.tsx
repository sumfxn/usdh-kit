import { Spinner } from '../icons.js'
import type { SourceChain } from './source-chain-pill.js'

export type ActionPhase = 'idle' | 'approving' | 'bridging' | 'swapping' | 'done'

export function ActionButton(props: {
  phase: ActionPhase
  insufficient: boolean
  belowMinOrderValue: boolean
  requiresBridge: boolean
  sourceChain: SourceChain
  needsTradingSession: boolean
  disabled: boolean
  onClick: () => void
}) {
  const {
    phase,
    insufficient,
    belowMinOrderValue,
    requiresBridge,
    sourceChain,
    needsTradingSession,
    disabled,
    onClick,
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
        `Insufficient ${sourceChain === 'evm' ? 'HyperEVM' : 'HyperCore'} USDC`
      ) : belowMinOrderValue ? (
        'Minimum 11 USDC'
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
