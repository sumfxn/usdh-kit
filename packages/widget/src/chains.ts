import type { HyperNetwork } from './types.js'

export const HYPER_EVM_CHAIN_ID: Record<HyperNetwork, number> = {
  mainnet: 999,
  testnet: 998,
}

export function networkLabel(network: HyperNetwork): string {
  return network === 'mainnet' ? 'HyperEVM Mainnet' : 'HyperEVM Testnet'
}
