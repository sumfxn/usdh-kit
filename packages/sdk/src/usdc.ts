import type { Address } from './types/hex.js'
import type { Network } from './types/network.js'

/**
 * Circle native USDC on HyperEVM. Distinct from the CoreDepositWallet address
 * exposed in Hyperliquid `spotMeta` for token index 0.
 */
export const HYPER_EVM_NATIVE_USDC: Record<Network, Address> = {
  mainnet: '0xb88339cb7199b77e23db6e890353e22632ba630f',
  testnet: '0x2b3370ee501b4a559b57d449569354196457d8ab',
}

export function getHyperEvmNativeUsdcAddress(network: Network): Address {
  return HYPER_EVM_NATIVE_USDC[network]
}
