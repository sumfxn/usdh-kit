import { SwitchHorizontal } from '../icons.js'

export type SourceChain = 'evm' | 'hc'

export function SourceChainPill(props: {
  sourceChain: SourceChain
  onToggle: () => void
  disabled: boolean
}) {
  const { sourceChain, onToggle, disabled } = props
  const label = sourceChain === 'evm' ? 'HyperEVM' : 'HyperCore'
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={`Source chain: ${label}. Click to switch.`}
      className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-usdh-text-soft transition hover:bg-usdh-surface-2/60 hover:text-usdh-text disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>from {label}</span>
      <SwitchHorizontal className="text-usdh-text-faint transition group-hover:text-usdh-text-muted" />
    </button>
  )
}
