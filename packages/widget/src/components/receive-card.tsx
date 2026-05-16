import { Spinner, UsdcIcon, UsdhIcon } from '../icons.js'
import { TokenChip } from './token-chip.js'

export function ReceiveCard(props: {
  receiveDisplay: string
  receiveUsdValue: string | null
  isQuoting: boolean
  hasQuote: boolean
  /** Receive-side token ticker. Defaults to `'USDH'` for USDHSwap. */
  receiveTicker?: 'USDC' | 'USDH'
}) {
  const { receiveDisplay, receiveUsdValue, isQuoting, hasQuote, receiveTicker = 'USDH' } = props
  const displayClass =
    receiveDisplay.length > 12 ? 'text-lg font-medium' : 'text-3xl font-light tracking-tight'
  return (
    <div className="rounded-xl border border-usdh-border/70 bg-usdh-surface/40 p-3.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-usdh-text-soft">
        <span>You receive</span>
        <span className="font-mono text-usdh-text-soft">on HyperCore</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className={`min-w-0 flex-1 truncate font-sans text-usdh-text ${displayClass}`}>
          {isQuoting && !hasQuote ? <Spinner className="h-5 w-5" /> : receiveDisplay}
        </span>
        <TokenChip
          icon={receiveTicker === 'USDC' ? <UsdcIcon /> : <UsdhIcon />}
          ticker={receiveTicker}
        />
      </div>
      <p className="mt-2 text-[11px] text-usdh-text-soft">{receiveUsdValue ?? ' '}</p>
    </div>
  )
}
