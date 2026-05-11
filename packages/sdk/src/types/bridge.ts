import type { Address, Hex } from './hex.js'

/** Stablecoins supported by `bridgeToCore`. V1: USDC only; USDT lands later. */
export type BridgeToCoreAsset = 'USDC' | 'USDT'
export type BridgeAsset = BridgeToCoreAsset
export type BridgeFromCoreAsset = 'USDC' | 'USDH'

export interface BridgeInput {
  /** Asset to bridge from HyperEVM to HyperCore. */
  asset: BridgeToCoreAsset
  /**
   * Amount in the EVM ERC20 smallest unit. USDC has 6 decimals on HyperEVM,
   * so `1_000_000n` = 1.00 USDC. The HyperCore credit is scaled to HC native
   * decimals automatically.
   */
  amount: bigint
  /** Override the default credit poll timeout (ms). Defaults to 180_000. */
  waitForCreditTimeoutMs?: number
}

export interface BridgeResult {
  /** HyperEVM transaction hash. */
  txHash: Hex
  /** Wall-clock ms when HyperCore reflected the deposit. */
  creditedAt: number
}

export interface BridgeFromCoreInput {
  /** Linked spot asset to bridge from HyperCore to HyperEVM. */
  asset: BridgeFromCoreAsset
  /** Amount in the linked HyperEVM asset's smallest unit. */
  amount: bigint
}

export interface BridgeFromCoreResult {
  /** The sendAsset action was accepted; HyperEVM credit is asynchronous. */
  status: 'submitted'
  asset: BridgeFromCoreAsset
  amount: bigint
  /** EVM decimals derived from `spotMeta` for formatting the sendAsset amount. */
  evmDecimals: number
  /** HyperCore system address used as the sendAsset destination. */
  systemAddress: Address
  /** HyperEVM recipient. Protocol credits the sender of the Core action. */
  recipient: Address
  /** Nonce/submission time used for the signed user action. */
  submittedAt: number
}
