import { Spinner } from '../icons.js'

export function WrongNetworkBanner(props: { onSwitch: () => void; isSwitching: boolean }) {
  const { onSwitch, isSwitching } = props
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-usdh-border bg-usdh-surface/60 px-3 py-2 text-xs">
      <span className="text-usdh-text-muted">Wrong network</span>
      <button
        type="button"
        onClick={onSwitch}
        disabled={isSwitching}
        className="inline-flex items-center gap-1.5 rounded-md bg-usdh-cta-bg px-2.5 py-1 text-[11px] font-medium text-usdh-cta-text hover:bg-usdh-cta-bg-hover disabled:opacity-50"
      >
        {isSwitching && <Spinner />}
        Switch
      </button>
    </div>
  )
}
