import { bpsToPercent } from '../format-display.js'

const SLIPPAGE_PRESETS_BPS = [10, 30, 50, 100] as const

export function SlippageRow(props: {
  slippageBps: number
  onPreset: (bps: number) => void
  showCustom: boolean
  onToggleCustom: () => void
  customStr: string
  onCustomChange: (next: string) => void
  disabled: boolean
}) {
  const { slippageBps, onPreset, showCustom, onToggleCustom, customStr, onCustomChange, disabled } =
    props

  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-usdh-text-soft">Slippage</p>
      <div className="flex flex-wrap items-center gap-1">
        {SLIPPAGE_PRESETS_BPS.map((bps) => {
          const active = slippageBps === bps && !showCustom
          return (
            <button
              key={bps}
              type="button"
              onClick={() => onPreset(bps)}
              aria-pressed={active}
              disabled={disabled}
              className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                active
                  ? 'border-usdh-cta-bg bg-usdh-cta-bg text-usdh-cta-text'
                  : 'border-usdh-border text-usdh-text-soft hover:border-usdh-border-strong hover:text-usdh-text'
              }`}
            >
              {bpsToPercent(bps)}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onToggleCustom}
          aria-pressed={showCustom}
          disabled={disabled}
          className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
            showCustom
              ? 'border-usdh-cta-bg bg-usdh-cta-bg text-usdh-cta-text'
              : 'border-usdh-border text-usdh-text-soft hover:border-usdh-border-strong hover:text-usdh-text'
          }`}
        >
          Custom
        </button>
        {showCustom && (
          <div className="flex items-center gap-1 rounded-md border border-usdh-border px-2 py-1 font-mono text-[11px]">
            <input
              type="text"
              inputMode="decimal"
              value={customStr}
              onChange={(e) => onCustomChange(e.target.value)}
              placeholder="0.30"
              aria-label="Custom slippage percent"
              className="w-10 bg-transparent text-usdh-text outline-none placeholder:text-usdh-placeholder"
            />
            <span className="text-usdh-text-soft">%</span>
          </div>
        )}
      </div>
    </div>
  )
}
