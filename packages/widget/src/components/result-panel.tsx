import { trimReceive } from '../format-display.js'
const USDC_DECIMALS = 6

export interface ResultPanelPayload {
  orderId: string
  receivedAmount: bigint
  spentAmount?: bigint
  requestedAmount?: bigint
  txHash?: `0x${string}`
}

export function ResultPanel(props: {
  result: ResultPanelPayload
  onReset: () => void
  /** Received-token ticker shown in the receipt. Defaults to `'USDH'` for USDHSwap. */
  receiveTicker?: 'USDC' | 'USDH'
  spentTicker?: 'USDC' | 'USDH'
  resetLabel?: string
}) {
  const {
    result,
    onReset,
    receiveTicker = 'USDH',
    spentTicker = 'USDC',
    resetLabel = 'Swap again',
  } = props
  const partialFill =
    result.spentAmount !== undefined &&
    result.requestedAmount !== undefined &&
    result.spentAmount < result.requestedAmount
  return (
    <div className="mt-3 rounded-xl border border-usdh-border bg-usdh-surface/50 p-3 text-[11px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center rounded-md border border-usdh-border bg-usdh-bg/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-usdh-text">
            {partialFill ? 'Partially filled' : 'Filled'}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-usdh-text-faint">Received</p>
          <p className="mt-0.5 font-mono text-base text-usdh-text">
            {trimReceive(result.receivedAmount, USDC_DECIMALS)} {receiveTicker}
          </p>
          {result.spentAmount !== undefined && (
            <p className="mt-1 text-[11px] text-usdh-text-soft">
              Spent{' '}
              <span className="font-mono text-usdh-text">
                {trimReceive(result.spentAmount, USDC_DECIMALS)}
              </span>{' '}
              {spentTicker}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-usdh-border px-2 py-1 text-[10px] font-medium text-usdh-text-soft transition hover:border-usdh-border-strong hover:text-usdh-text"
        >
          {resetLabel}
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
      {partialFill && result.spentAmount !== undefined && result.requestedAmount !== undefined ? (
        <p className="mt-2 text-[11px] leading-snug text-usdh-text-soft">
          Migrated{' '}
          <span className="font-mono text-usdh-text">
            {trimReceive(result.spentAmount, USDC_DECIMALS)}
          </span>{' '}
          of{' '}
          <span className="font-mono text-usdh-text">
            {trimReceive(result.requestedAmount, USDC_DECIMALS)}
          </span>{' '}
          {spentTicker}. The unfilled balance remains on HyperCore.
        </p>
      ) : null}
    </div>
  )
}
