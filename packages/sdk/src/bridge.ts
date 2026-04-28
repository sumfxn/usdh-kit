import { encodeErc20Transfer } from './abi.js'
import { bigintToBytesBE, bytesToHex } from './bytes.js'
import {
  BridgeTimeoutError,
  InvalidInputError,
  MissingEvmWalletError,
  NetworkError,
} from './errors.js'
import type { InfoClient } from './transport/info.js'
import type { SpotMeta, SpotToken } from './transport/types.js'
import type { BridgeAsset, BridgeInput, BridgeResult } from './types/bridge.js'
import type { EvmWallet } from './types/evm-wallet.js'
import type { Address, Hex } from './types/hex.js'
import type { Logger } from './types/logger.js'
import type { Network } from './types/network.js'

/** HyperEVM chain ids per network. */
const HYPER_EVM_CHAIN_ID: Record<Network, number> = {
  mainnet: 999,
  testnet: 998,
}

const DEFAULT_CREDIT_TIMEOUT_MS = 30_000
const CREDIT_POLL_INTERVAL_MS = 1_000

const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

export interface BridgeDeps {
  info: InfoClient
  evmWallet: EvmWallet | undefined
  network: Network
  logger: Logger
  /** Override `Date.now`; injected for tests. */
  now?: () => number
  /** Override the polling sleep; injected for tests. */
  sleep?: (ms: number) => Promise<void>
}

/** Lowercase an address so equality checks across HL/EVM sources stay consistent. */
function normalizeAddress(addr: Address): Address {
  return addr.toLowerCase() as Address
}

/**
 * Derive a HyperCore system address from a token's `spotMeta` index.
 *
 * Format (per HL docs): `address[0] = 0x20`, the remaining 19 bytes encode the
 * token index in big-endian. Example: index 1385 → `0x2000…000569`.
 */
export function tokenSystemAddress(tokenIndex: number): Address {
  if (!Number.isInteger(tokenIndex) || tokenIndex < 0) {
    throw new InvalidInputError(`tokenIndex must be a non-negative integer, got ${tokenIndex}`)
  }
  const sys = new Uint8Array(20)
  sys[0] = 0x20
  const tail = bigintToBytesBE(BigInt(tokenIndex), 19)
  sys.set(tail, 1)
  return bytesToHex(sys) as Address
}

function findStableToken(meta: SpotMeta, asset: BridgeAsset): SpotToken {
  const token = meta.tokens.find((t) => t.name === asset)
  if (!token) {
    throw new NetworkError(`${asset} not found in spotMeta`)
  }
  if (!token.evmContract || !token.evmContract.address) {
    throw new NetworkError(`${asset} has no HyperEVM contract; bridging not supported`)
  }
  return token
}

/** Convert an EVM-unit amount to the HyperCore-unit equivalent. */
export function evmToCoreUnits(amountEvm: bigint, evmExtraDecimals: number): bigint {
  // HC weiDecimals = EVM decimals - evmExtraWeiDecimals  → credit in HC units
  // is amountEvm * 10^(-evmExtraWeiDecimals).
  const exp = -evmExtraDecimals
  if (exp >= 0) {
    return amountEvm * 10n ** BigInt(exp)
  }
  return amountEvm / 10n ** BigInt(-exp)
}

function parseHcAmount(value: string, weiDecimals: number): bigint {
  const trimmed = value.trim()
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(trimmed)) {
    throw new NetworkError(`unparsable HC balance: ${value}`)
  }
  const [intPart, fracPart = ''] = trimmed.split('.')
  if (fracPart.length > weiDecimals) {
    throw new NetworkError(`balance ${value} has more decimals than weiDecimals=${weiDecimals}`)
  }
  const padded = fracPart.padEnd(weiDecimals, '0')
  return BigInt(intPart + padded)
}

async function readCoreBalance(
  info: InfoClient,
  user: Address,
  tokenIndex: number,
  weiDecimals: number,
): Promise<bigint> {
  const state = await info.spotClearinghouseState(user)
  const row = state.balances.find((b) => b.token === tokenIndex)
  if (!row) {
    return 0n
  }
  return parseHcAmount(row.total, weiDecimals)
}

export interface BridgeRunArgs extends BridgeInput {
  user: Address
}

/**
 * Send the HyperEVM ERC20 transfer to the token's system address, then poll
 * `spotClearinghouseState` until the HyperCore balance reflects the deposit.
 *
 * Concurrency caveat: callers MUST NOT overlap two `bridgeToCore` calls for
 * the same `(user, asset)` pair. The credit detector watches a balance delta
 * and cannot tell two in-flight deposits apart — both calls would resolve on
 * whichever credit lands first. Sequential calls are safe.
 */
export async function runBridgeToCore(
  args: BridgeRunArgs,
  deps: BridgeDeps,
): Promise<BridgeResult> {
  const { info, evmWallet, network, logger } = deps
  if (!evmWallet) {
    throw new MissingEvmWalletError()
  }
  if (typeof args.amount !== 'bigint' || args.amount <= 0n) {
    throw new InvalidInputError('amount must be a positive bigint')
  }
  if (args.asset !== 'USDC' && args.asset !== 'USDT') {
    throw new InvalidInputError(`asset must be 'USDC' or 'USDT', got ${String(args.asset)}`)
  }
  const timeoutMs = args.waitForCreditTimeoutMs ?? DEFAULT_CREDIT_TIMEOUT_MS
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new InvalidInputError('waitForCreditTimeoutMs must be a positive number')
  }
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))

  const meta = await info.spotMeta()
  const token = findStableToken(meta, args.asset)
  const evmContractRaw = token.evmContract?.address
  if (!evmContractRaw) {
    throw new NetworkError(`${args.asset} HyperEVM contract resolved to undefined`)
  }
  const evmContract = normalizeAddress(evmContractRaw)
  const sysAddress = tokenSystemAddress(token.index)
  const userAddress = normalizeAddress(args.user)
  const evmExtra = token.evmContract?.evm_extra_wei_decimals ?? 0
  const expectedCreditHc = evmToCoreUnits(args.amount, evmExtra)

  logger.debug('bridge.requested', {
    asset: args.asset,
    amount: args.amount.toString(),
    sysAddress,
    evmContract,
    tokenIndex: token.index,
    network,
  })

  const data: Hex = encodeErc20Transfer(sysAddress, args.amount)
  const txHashRaw = await evmWallet.sendTransaction({
    to: evmContract,
    data,
    chainId: HYPER_EVM_CHAIN_ID[network],
  })
  if (!TX_HASH_PATTERN.test(txHashRaw)) {
    throw new NetworkError(`evmWallet returned malformed tx hash: ${txHashRaw}`)
  }
  const txHash = txHashRaw.toLowerCase() as Hex
  logger.info('bridge.submitted', { txHash, asset: args.asset })

  // Snapshot AFTER broadcast so a credit that lands between meta-fetch and
  // sendTransaction (e.g. an unrelated parallel deposit) is excluded from
  // our delta — narrows but does not eliminate the race.
  const balanceBefore = await readCoreBalance(info, userAddress, token.index, token.weiDecimals)

  const deadline = now() + timeoutMs
  while (now() < deadline) {
    let balance: bigint
    try {
      balance = await readCoreBalance(info, userAddress, token.index, token.weiDecimals)
    } catch (err) {
      logger.warn('bridge.poll.error', { txHash, error: String(err) })
      await sleep(CREDIT_POLL_INTERVAL_MS)
      continue
    }
    if (balance - balanceBefore >= expectedCreditHc) {
      const creditedAt = now()
      logger.info('bridge.credited', { txHash, asset: args.asset, creditedAt })
      return { txHash, creditedAt }
    }
    await sleep(CREDIT_POLL_INTERVAL_MS)
  }
  throw new BridgeTimeoutError(txHash, timeoutMs)
}
