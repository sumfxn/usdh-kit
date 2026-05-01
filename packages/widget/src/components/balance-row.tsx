import { formatBalance } from '../format-display.js'
import { RefreshIcon } from '../icons.js'
import type { UsdcBalances } from '../use-balances.js'
import type { SourceChain } from './source-chain-pill.js'

export function BalanceRow(props: {
  balances: UsdcBalances
  sourceChain: SourceChain
  onRefresh: () => void
}) {
  const { balances, sourceChain, onRefresh } = props
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <p className="text-[10px] uppercase tracking-wider text-usdh-text-faint">Balances</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={balances.isRefreshing}
          aria-label="Refresh balances"
          className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-usdh-border/70 text-usdh-text-faint transition hover:border-usdh-border-strong hover:text-usdh-text-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshIcon className={balances.isRefreshing ? 'animate-spin' : undefined} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <BalanceCell
          label="HyperEVM"
          value={formatUsdcBalance(balances.evm, balances.evmDecimals)}
          active={sourceChain === 'evm'}
        />
        <BalanceCell
          label="HyperCore"
          value={formatUsdcBalance(balances.hc, balances.hcDecimals)}
          active={sourceChain === 'hc'}
        />
      </div>
    </div>
  )
}

function formatUsdcBalance(amount: bigint | undefined, decimals: number | undefined): string {
  const formatted = formatBalance(amount, decimals)
  return formatted === '—' ? formatted : `${formatted} USDC`
}

function BalanceCell(props: { label: string; value: string; active: boolean }) {
  const { label, value, active } = props
  return (
    <div className="rounded-lg border border-usdh-border/70 bg-usdh-surface/40 px-3 py-2">
      <p className="truncate text-[10px] uppercase tracking-wider text-usdh-text-faint">{label}</p>
      <p
        className={`mt-1 truncate font-mono text-xs ${active ? 'text-usdh-text' : 'text-usdh-text-soft'}`}
      >
        {value}
      </p>
    </div>
  )
}
