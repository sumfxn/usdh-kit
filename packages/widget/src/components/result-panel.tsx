import { trimReceive } from '../format-display.js'
import type { SwapResultPayload } from '../types.js'

const USDC_DECIMALS = 6

export function ResultPanel(props: { result: SwapResultPayload; onReset: () => void }) {
  const { result, onReset } = props
  return (
    <div className="mt-3 rounded-xl border border-usdh-border bg-usdh-surface/50 p-3 text-[11px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center rounded-md border border-usdh-border bg-usdh-bg/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-usdh-text">
            Filled
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-usdh-text-faint">Received</p>
          <p className="mt-0.5 font-mono text-base text-usdh-text">
            {trimReceive(result.receivedUsdh, USDC_DECIMALS)} USDH
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-usdh-border px-2 py-1 text-[10px] font-medium text-usdh-text-soft transition hover:border-usdh-border-strong hover:text-usdh-text"
        >
          Swap again
        </button>
      </div>
      <p className="mt-3 border-t border-usdh-border pt-2 font-mono text-[10px] text-usdh-text-soft">
        Order {result.orderId}
        {result.txHash && (
          <>
            {' · '}
            <span className="font-mono">
              {result.txHash.slice(0, 8)}…{result.txHash.slice(-6)}
            </span>
          </>
        )}
      </p>
    </div>
  )
}
