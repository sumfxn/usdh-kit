import type { EvmWallet } from './evm-wallet.js'
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
   * Real Hyperliquid account address for balances, routing, and bridge
   * ownership. Defaults to `signer.address`. Set this when `signer` is an
   * approved API/agent wallet that signs on behalf of the account.
   */
  accountAddress?: Address
  /**
   * Optional HyperEVM wallet for `bridgeToCore`. Only required when bridging
   * stables from HyperEVM to HyperCore; `swap`/`getQuote` do not use it.
   */
  evmWallet?: EvmWallet
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
  /** Override the global fetch. */
  fetch?: typeof fetch
  /** Per-request timeout in ms. Defaults to 10s. */
  timeoutMs?: number
}
