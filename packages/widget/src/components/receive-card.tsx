import { Spinner, UsdhIcon } from '../icons.js'
import { TokenChip } from './token-chip.js'

export function ReceiveCard(props: {
  receiveDisplay: string
  receiveUsdValue: string | null
  isQuoting: boolean
  hasQuote: boolean
}) {
  const { receiveDisplay, receiveUsdValue, isQuoting, hasQuote } = props
  return (
    <div className="rounded-xl border border-usdh-border/70 bg-usdh-surface/40 p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-usdh-text-soft">
        <span>You receive</span>
        <span className="font-mono text-usdh-text-soft">on HyperCore</span>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-sans text-4xl font-light tracking-tight text-usdh-text">
          {isQuoting && !hasQuote ? <Spinner className="h-5 w-5" /> : receiveDisplay}
        </span>
        <TokenChip icon={<UsdhIcon />} ticker="USDH" />
      </div>
      <p className="mt-2 text-[11px] text-usdh-text-soft">{receiveUsdValue ?? ' '}</p>
    </div>
  )
}
