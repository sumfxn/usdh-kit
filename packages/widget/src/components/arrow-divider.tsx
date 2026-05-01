import { ArrowDown } from '../icons.js'

export function ArrowDivider() {
  return (
    <div className="flex justify-center py-1" aria-hidden="true">
      <span className="flex h-5 w-5 items-center justify-center rounded-md border border-usdh-border bg-usdh-surface/40 text-usdh-text-soft">
        <ArrowDown />
      </span>
    </div>
  )
}
