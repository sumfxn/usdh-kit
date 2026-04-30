import { formatBalance } from '../format-display.js'
import { UsdcIcon } from '../icons.js'
import type { UsdcBalances } from '../use-balances.js'
import { type SourceChain, SourceChainPill } from './source-chain-pill.js'
import { TokenChip } from './token-chip.js'

export function PayCard(props: {
  amountStr: string
  onAmountChange: (next: string) => void
  inputDisabled: boolean
  sourceChain: SourceChain
  onSourceToggle: () => void
  payUsdValue: string | null
  balances: UsdcBalances
  balancesLoaded: boolean
  hasMaxBalance: boolean
  onMax: () => void
}) {
  const {
    amountStr,
    onAmountChange,
    inputDisabled,
    sourceChain,
    onSourceToggle,
    payUsdValue,
    balances,
    balancesLoaded,
    hasMaxBalance,
    onMax,
  } = props

  return (
    <div className="rounded-xl border border-usdh-border/70 bg-usdh-surface/40 p-4">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-usdh-text-soft">
        <span>You pay</span>
        <SourceChainPill
          sourceChain={sourceChain}
          onToggle={onSourceToggle}
          disabled={inputDisabled}
        />
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => onAmountChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          disabled={inputDisabled}
          aria-label="Amount in USDC"
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent font-sans text-4xl font-light tracking-tight text-usdh-text outline-none placeholder:text-usdh-placeholder disabled:opacity-60"
        />
        <TokenChip icon={<UsdcIcon />} ticker="USDC" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-usdh-text-soft">
        <span className="min-w-0 truncate">
          {payUsdValue && <span className="text-usdh-text-soft">{payUsdValue}</span>}
          {balancesLoaded && (
            <span className="ml-2">
              <span className="text-usdh-text-faint">EVM </span>
              <span
                className={`font-mono ${sourceChain === 'evm' ? 'text-usdh-text' : 'text-usdh-text-faint'}`}
              >
                {formatBalance(balances.evm, balances.evmDecimals)}
              </span>
              <span className="mx-1.5 text-usdh-text-faint">·</span>
              <span className="text-usdh-text-faint">HC </span>
              <span
                className={`font-mono ${sourceChain === 'hc' ? 'text-usdh-text' : 'text-usdh-text-faint'}`}
              >
                {formatBalance(balances.hc, balances.hcDecimals)}
              </span>
            </span>
          )}
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
