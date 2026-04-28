import type { Address } from './hex.js'
import type { Logger } from './logger.js'
import type { Network } from './network.js'
import type { Signer } from './signer.js'

export interface KitConfig {
  /** Hyperliquid network. */
  network: Network
  /** Wallet abstraction. See `Signer`. */
  signer: Signer
  /**
   * Default slippage tolerance in basis points (1 bp = 0.01%).
   * @default 20
   */
  slippageBps?: number
  /** Optional structured logger. Defaults to silent. */
  logger?: Logger
  /**
   * Optional referrer address for future referral routing.
   * @experimental
   */
  referrer?: Address
}
