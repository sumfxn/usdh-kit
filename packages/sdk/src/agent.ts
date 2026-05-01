import { InvalidInputError, NetworkError, SigningError } from './errors.js'
import { parseSignature } from './signing.js'
import {
  type ExchangeClient,
  type ExchangeResponse,
  createExchangeClient,
} from './transport/exchange.js'
import type { Address, Hex } from './types/hex.js'
import type { Network } from './types/network.js'
import type { Signer } from './types/signer.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const DEFAULT_SIGNATURE_CHAIN_ID = 421_614

const USER_SIGNED_DOMAIN = {
  name: 'HyperliquidSignTransaction',
  version: '1',
  verifyingContract: ZERO_ADDRESS,
} as const

const APPROVE_AGENT_TYPES = {
  'HyperliquidTransaction:ApproveAgent': [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'agentAddress', type: 'address' },
    { name: 'agentName', type: 'string' },
    { name: 'nonce', type: 'uint64' },
  ],
} as const

export interface ApproveAgentArgs {
  /** Hyperliquid network. */
  network: Network
  /** Master account signer that approves the API/agent wallet. */
  signer: Signer
  /** Agent wallet address that will sign L1 trading actions. */
  agentAddress: Address
  /** Named agents avoid replacing another app's unnamed agent. */
  agentName?: string
  /**
   * Chain id used for the user-signed approval typed data. Hyperliquid accepts
   * arbitrary signing chains; browser wallets usually require this to match
   * the connected EVM chain.
   *
   * @default 421614 Hyperliquid's SDK default
   */
  signatureChainId?: number
  /** Override the global fetch used to submit `/exchange`. */
  fetch?: typeof fetch
  /** Per-request timeout in ms. Defaults to the exchange client default. */
  timeoutMs?: number
}

export interface ApproveAgentResult {
  agentAddress: Address
  agentName?: string
  response: ExchangeResponse
}

export async function approveAgent(args: ApproveAgentArgs): Promise<ApproveAgentResult> {
  validateApproveAgentArgs(args)

  const nonce = BigInt(Date.now())
  const agentName = args.agentName?.trim()
  const message = {
    hyperliquidChain: args.network === 'mainnet' ? 'Mainnet' : 'Testnet',
    agentAddress: normalizeAddress(args.agentAddress),
    agentName: agentName ?? '',
    nonce: Number(nonce),
  }
  let signatureHex: Hex
  try {
    signatureHex = await args.signer.signTypedData({
      domain: {
        ...USER_SIGNED_DOMAIN,
        chainId: args.signatureChainId ?? DEFAULT_SIGNATURE_CHAIN_ID,
      },
      types: APPROVE_AGENT_TYPES,
      primaryType: 'HyperliquidTransaction:ApproveAgent',
      message,
    })
  } catch (err) {
    throw new SigningError('approveAgent signing rejected', { cause: err })
  }

  const action = {
    type: 'approveAgent',
    hyperliquidChain: message.hyperliquidChain,
    signatureChainId: toHexChainId(args.signatureChainId ?? DEFAULT_SIGNATURE_CHAIN_ID),
    agentAddress: message.agentAddress,
    ...(agentName !== undefined && { agentName }),
    nonce: message.nonce,
  }
  const exchange = createExchangeClient({
    network: args.network,
    ...(args.fetch !== undefined && { fetch: args.fetch }),
    ...(args.timeoutMs !== undefined && { timeoutMs: args.timeoutMs }),
  })
  const response = await submitApproveAgent(exchange, action, signatureHex, nonce)
  return {
    agentAddress: message.agentAddress,
    ...(agentName !== undefined && { agentName }),
    response,
  }
}

async function submitApproveAgent(
  exchange: ExchangeClient,
  action: unknown,
  signatureHex: Hex,
  nonce: bigint,
): Promise<ExchangeResponse> {
  const response = await exchange.submit({
    action,
    signature: parseSignature(signatureHex),
    nonce,
  })
  if (response.status === 'err') {
    throw new NetworkError(`exchange error: ${response.response}`)
  }
  return response
}

function validateApproveAgentArgs(args: ApproveAgentArgs): void {
  if (args.network !== 'mainnet' && args.network !== 'testnet') {
    throw new InvalidInputError(`network must be 'mainnet' or 'testnet'`)
  }
  if (args.signer === undefined || args.signer === null) {
    throw new InvalidInputError('signer is required')
  }
  normalizeAddress(args.agentAddress)
  if (args.agentName !== undefined && args.agentName.trim() === '') {
    throw new InvalidInputError('agentName must not be empty')
  }
  const signatureChainId = args.signatureChainId ?? DEFAULT_SIGNATURE_CHAIN_ID
  if (!Number.isSafeInteger(signatureChainId) || signatureChainId <= 0) {
    throw new InvalidInputError('signatureChainId must be a positive safe integer')
  }
}

function normalizeAddress(address: Address): Address {
  if (!ADDRESS_PATTERN.test(address)) {
    throw new InvalidInputError(`address is not a 20-byte hex address: ${address}`)
  }
  return address.toLowerCase() as Address
}

function toHexChainId(chainId: number): Hex {
  return `0x${chainId.toString(16)}` as Hex
}
