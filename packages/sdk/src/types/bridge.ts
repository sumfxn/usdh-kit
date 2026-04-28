import type { Hex } from './hex.js'

/** Stablecoins supported by `bridgeToCore`. V1: USDC only; USDT lands later. */
export type BridgeAsset = 'USDC' | 'USDT'

export interface BridgeInput {
  /** Asset to bridge from HyperEVM to HyperCore. */
  asset: BridgeAsset
  /**
   * Amount in the EVM ERC20 smallest unit. USDC has 6 decimals on HyperEVM,
   * so `1_000_000n` = 1.00 USDC. The HyperCore credit is scaled to HC native
   * decimals automatically.
   */
  amount: bigint
  /** Override the default credit poll timeout (ms). Defaults to 30_000. */
  waitForCreditTimeoutMs?: number
}

export interface BridgeResult {
  /** HyperEVM transaction hash. */
  txHash: Hex
  /** Wall-clock ms when HyperCore reflected the deposit. */
  creditedAt: number
}
