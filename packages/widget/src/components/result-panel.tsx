import { trimReceive } from '../format-display.js'
import type { SwapResultPayload } from '../types.js'

const USDC_DECIMALS = 6

export function ResultPanel(props: { result: SwapResultPayload; onReset: () => void }) {
  const { result, onReset } = props
  return (
    <div className="mt-3 rounded-xl border border-usdh-border bg-usdh-bg/60 p-3 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="font-medium text-usdh-text">Filled</span>
        <span className="font-mono text-usdh-text">
          {trimReceive(result.receivedUsdh, USDC_DECIMALS)} USDH
        </span>
      </div>
      <p className="mt-1 text-[10px] text-usdh-text-soft">
        order {result.orderId}
        {result.txHash && (
          <>
            {' · '}
            <span className="font-mono">
              {result.txHash.slice(0, 8)}…{result.txHash.slice(-6)}
            </span>
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-2 text-[11px] text-usdh-text-soft underline hover:text-usdh-text"
      >
        Swap again
      </button>
    </div>
  )
}
