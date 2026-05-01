import { formatBalance } from '../format-display.js'
import type { UsdcBalances } from '../use-balances.js'
import type { SourceChain } from './source-chain-pill.js'

export function BalanceRow(props: { balances: UsdcBalances; sourceChain: SourceChain }) {
  const { balances, sourceChain } = props
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <BalanceCell
        label="HyperEVM balance"
        usdc={formatStableBalance(balances.evm, balances.evmDecimals, 'USDC')}
        usdh={formatStableBalance(balances.evmUsdh, balances.evmUsdhDecimals, 'USDH')}
        active={sourceChain === 'evm'}
      />
      <BalanceCell
        label="HyperCore balance"
        usdc={formatStableBalance(balances.hc, balances.hcDecimals, 'USDC')}
        usdh={formatStableBalance(balances.hcUsdh, balances.hcUsdhDecimals, 'USDH')}
        active={sourceChain === 'hc'}
      />
    </div>
  )
}

function formatStableBalance(
  amount: bigint | undefined,
  decimals: number | undefined,
  ticker: 'USDC' | 'USDH',
): string {
  const formatted = formatBalance(amount, decimals)
  return formatted === '—' ? formatted : `${formatted} ${ticker}`
}

function BalanceCell(props: { label: string; usdc: string; usdh: string; active: boolean }) {
  const { label, usdc, usdh, active } = props
  return (
    <div className="rounded-lg border border-usdh-border/70 bg-usdh-surface/40 px-3 py-2">
      <p className="truncate text-[10px] uppercase tracking-wider text-usdh-text-faint">{label}</p>
      <p
        className={`mt-1 truncate font-mono text-xs ${active ? 'text-usdh-text' : 'text-usdh-text-soft'}`}
      >
        {usdc}
      </p>
      <p className="mt-0.5 truncate font-mono text-[11px] text-usdh-text-soft">{usdh}</p>
    </div>
  )
}
