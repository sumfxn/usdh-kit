import { formatBalance } from '../format-display.js'
import type { UsdcBalances } from '../use-balances.js'
import type { SourceChain } from './source-chain-pill.js'

export function BalanceRow(props: { balances: UsdcBalances; sourceChain: SourceChain }) {
  const { balances, sourceChain } = props
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <BalanceCell
        label="HyperEVM balance"
        value={formatUsdcBalance(balances.evm, balances.evmDecimals)}
        active={sourceChain === 'evm'}
      />
      <BalanceCell
        label="HyperCore balance"
        value={formatUsdcBalance(balances.hc, balances.hcDecimals)}
        active={sourceChain === 'hc'}
      />
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
