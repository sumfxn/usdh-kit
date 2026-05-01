import type { Address, Hex } from './hex.js'

/**
 * HyperEVM transaction request. Implementations are expected to be configured
 * for the correct HyperEVM chain (mainnet 999, testnet 998); `chainId` is
 * passed as a sanity hint and may be ignored by adapters that pin the chain
 * out-of-band.
 */
export interface EvmTransactionRequest {
  to: Address
  data: Hex
  chainId?: number
}

/**
 * Minimal wallet abstraction for HyperEVM writes. Only required when calling
 * `bridgeToCore`. Adapt from viem `WalletClient`, ethers `Signer`, Privy,
 * Turnkey, or any custodial provider.
 *
 * `sendTransaction` MUST broadcast the transaction and resolve with its hash.
 * For flows that submit dependent transactions (such as USDC approve + deposit),
 * provide `waitForTransactionReceipt` so the kit can wait for inclusion between
 * steps.
 *
 * @example viem adapter
 * ```ts
 * import { createWalletClient, http } from 'viem'
 * const wc = createWalletClient({ account, chain: hyperEvmMainnet, transport: http() })
 * const evmWallet: EvmWallet = {
 *   address: account.address,
 *   sendTransaction: (req) => wc.sendTransaction({ to: req.to, data: req.data }),
 *   waitForTransactionReceipt: (hash) => publicClient.waitForTransactionReceipt({ hash }).then(() => {}),
 * }
 * ```
 */
export interface EvmWallet {
  readonly address: Address
  sendTransaction(req: EvmTransactionRequest): Promise<Hex>
  waitForTransactionReceipt?(txHash: Hex, chainId?: number): Promise<void>
}
