// keccak_256 is Ethereum-style keccak, not NIST SHA3. Do not switch to sha3_256.
import { keccak_256 } from '@noble/hashes/sha3'

import { bigintToBytesBE, bytesToHex, concatBytes, hexToBytes } from './bytes.js'
import { SigningError } from './errors.js'
import { encode as msgpackEncode } from './msgpack.js'
import type { Address, Hex } from './types/hex.js'
import type { Network } from './types/network.js'
import type { Signer } from './types/signer.js'

const PHANTOM_AGENT_DOMAIN = {
  name: 'Exchange',
  version: '1',
  chainId: 1337,
  verifyingContract: '0x0000000000000000000000000000000000000000',
} as const

const PHANTOM_AGENT_TYPES = {
  Agent: [
    { name: 'source', type: 'string' },
    { name: 'connectionId', type: 'bytes32' },
  ],
} as const

export interface L1Signature {
  r: Hex
  s: Hex
  v: number
}

export interface SignL1ActionArgs {
  signer: Signer
  action: unknown
  nonce: bigint
  network: Network
  vaultAddress?: Address
  expiresAfter?: bigint
}

/**
 * Sign a Hyperliquid L1 action (order, cancel, etc.).
 *
 * Steps: msgpack-encode the action, append the nonce big-endian and the
 * vault marker, keccak256 the buffer, then EIP-712 sign the resulting
 * phantom-agent typed data via the configured Signer.
 *
 * The connectionId field (the action hash) carries the action-level
 * commitment; the EIP-712 domain is HL-specific (chainId 1337 by spec).
 */
export async function signL1Action(args: SignL1ActionArgs): Promise<L1Signature> {
  const connectionId = computeActionHash(
    args.action,
    args.nonce,
    args.vaultAddress,
    args.expiresAfter,
  )
  const source = args.network === 'mainnet' ? 'a' : 'b'
  let sigHex: Hex
  try {
    sigHex = await args.signer.signTypedData({
      domain: PHANTOM_AGENT_DOMAIN,
      types: PHANTOM_AGENT_TYPES,
      primaryType: 'Agent',
      message: { source, connectionId },
    })
  } catch (err) {
    throw new SigningError('signer.signTypedData rejected', { cause: err })
  }
  return parseSignature(sigHex)
}

/**
 * Compute the HL action hash used as `connectionId` in the phantom-agent
 * EIP-712 message. Encodes the action via msgpack, appends nonce as
 * big-endian uint64 and the vault marker, then keccak256s the result.
 */
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

export function computeActionHash(
  action: unknown,
  nonce: bigint,
  vaultAddress?: Address,
  expiresAfter?: bigint,
): Hex {
  const actionBytes = msgpackEncode(action)
  const nonceBytes = bigintToBytesBE(nonce, 8)
  let payload: Uint8Array
  if (vaultAddress === undefined) {
    payload = concatBytes(actionBytes, nonceBytes, Uint8Array.of(0x00))
  } else {
    if (!ADDRESS_PATTERN.test(vaultAddress)) {
      throw new SigningError(`vaultAddress is not a 20-byte hex address: ${vaultAddress}`)
    }
    const addrBytes = hexToBytes(vaultAddress.toLowerCase())
    payload = concatBytes(actionBytes, nonceBytes, Uint8Array.of(0x01), addrBytes)
  }
  if (expiresAfter !== undefined) {
    payload = concatBytes(payload, Uint8Array.of(0x00), bigintToBytesBE(expiresAfter, 8))
  }
  return bytesToHex(keccak_256(payload))
}

/**
 * Parse a 65-byte hex signature (r ++ s ++ v) into an L1Signature.
 * Accepts both `27/28` and `0/1` recovery values.
 */
export function parseSignature(sigHex: string): L1Signature {
  const cleaned = sigHex.startsWith('0x') ? sigHex.slice(2) : sigHex
  if (cleaned.length !== 130) {
    throw new SigningError(`expected 65-byte signature, got ${cleaned.length / 2} bytes`)
  }
  const rawV = Number.parseInt(cleaned.slice(128, 130), 16)
  if (Number.isNaN(rawV)) {
    throw new SigningError('signature recovery byte is not hex')
  }
  const v = rawV < 27 ? rawV + 27 : rawV
  if (v !== 27 && v !== 28) {
    throw new SigningError(`non-canonical recovery byte: ${rawV} (expected 0/1 or 27/28)`)
  }
  return {
    r: `0x${cleaned.slice(0, 64)}` as Hex,
    s: `0x${cleaned.slice(64, 128)}` as Hex,
    v,
  }
}
