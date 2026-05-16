import { UsdcIcon, UsdhIcon } from '../icons.js'
import { type SourceChain, SourceChainPill } from './source-chain-pill.js'
import { TokenChip } from './token-chip.js'

export function PayCard(props: {
  amountStr: string
  onAmountChange: (next: string) => void
  inputDisabled: boolean
  /** Source-chain pill controls. Omit to hide the pill (e.g. HyperCore-only flows). */
  sourceChain?: SourceChain
  onSourceToggle?: () => void
  payUsdValue: string | null
  hasMaxBalance: boolean
  onMax: () => void
  /** Pay-side token ticker. Defaults to `'USDC'` for USDHSwap. */
  payTicker?: 'USDC' | 'USDH'
}) {
  const {
    amountStr,
    onAmountChange,
    inputDisabled,
    sourceChain,
    onSourceToggle,
    payUsdValue,
    hasMaxBalance,
    onMax,
    payTicker = 'USDC',
  } = props

  return (
    <div className="rounded-xl border border-usdh-border/70 bg-usdh-surface/40 p-3.5">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-usdh-text-soft">
        <span>You pay</span>
        {sourceChain !== undefined && onSourceToggle !== undefined && (
          <SourceChainPill
            sourceChain={sourceChain}
            onToggle={onSourceToggle}
            disabled={inputDisabled}
          />
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => onAmountChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          disabled={inputDisabled}
          aria-label={`Amount in ${payTicker}`}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent font-sans text-3xl font-light tracking-tight text-usdh-text outline-none placeholder:text-usdh-placeholder disabled:opacity-60"
        />
        <TokenChip icon={payTicker === 'USDH' ? <UsdhIcon /> : <UsdcIcon />} ticker={payTicker} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-usdh-text-soft">
        <span className="min-w-0 truncate">
          {payUsdValue && <span className="text-usdh-text-soft">{payUsdValue}</span>}
        </span>
        {hasMaxBalance && (
          <button
            type="button"
            onClick={onMax}
            disabled={inputDisabled}
            className="shrink-0 rounded border border-usdh-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-usdh-text-soft transition hover:border-usdh-border-strong hover:text-usdh-text disabled:opacity-50"
          >
            Max
          </button>
        )}
      </div>
    </div>
  )
}
