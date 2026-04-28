'use client'

import { useAccount, useChainId } from 'wagmi'

import { hyperEvmMainnet, hyperEvmTestnet } from '../lib/chains'

export function ConnectionStatus() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()

  if (!isConnected || !address) {
    return (
      <p className="text-sm text-neutral-500">Not connected. Click Connect Wallet to continue.</p>
    )
  }

  const network =
    chainId === hyperEvmMainnet.id
      ? 'HyperEVM Mainnet'
      : chainId === hyperEvmTestnet.id
        ? 'HyperEVM Testnet'
        : `Chain ${chainId} (unsupported)`

  return (
    <div className="space-y-1 text-sm">
      <p className="text-neutral-300">
        Connected: <span className="font-mono text-neutral-100">{address}</span>
      </p>
      <p className="text-neutral-500">{network}</p>
    </div>
  )
}
