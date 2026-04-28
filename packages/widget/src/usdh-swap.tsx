import type { ReactElement } from 'react'

export type USDHSwapProps = {
  network?: 'mainnet' | 'testnet'
}

export function USDHSwap({ network = 'mainnet' }: USDHSwapProps): ReactElement {
  return (
    <div className="usdh-kit-widget" data-network={network}>
      <p>USDH Swap widget ({network})</p>
      <p>Implementation arrives in the next PR.</p>
    </div>
  )
}
