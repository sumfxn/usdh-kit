import type { ReactNode } from 'react'

export function TokenChip({ icon, ticker }: { icon: ReactNode; ticker: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-usdh-border-strong/60 bg-usdh-surface py-1 pl-1 pr-3 font-medium text-sm text-usdh-text shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]">
      {icon}
      {ticker}
    </span>
  )
}
