import type { HyperNetwork } from '../types.js'

const NETWORKS: ReadonlyArray<HyperNetwork> = ['testnet', 'mainnet']

export function NetworkToggle(props: {
  network: HyperNetwork
  onChange: (network: HyperNetwork) => void
  disabled: boolean
}) {
  const { network, onChange, disabled } = props
  return (
    <div className="inline-flex rounded-md border border-usdh-border p-0.5 text-[10px] uppercase tracking-wider">
      {NETWORKS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-pressed={network === n}
          disabled={disabled}
          className={`rounded px-2 py-1 transition ${
            network === n
              ? 'bg-usdh-surface-2 text-usdh-text'
              : 'text-usdh-text-soft hover:text-usdh-text-muted'
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {n === 'mainnet' ? 'Mainnet' : 'Testnet'}
        </button>
      ))}
    </div>
  )
}
