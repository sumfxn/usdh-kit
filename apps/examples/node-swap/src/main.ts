/**
 * End-to-end example: bridge USDC from HyperEVM to HyperCore, then swap
 * USDC → USDH using a market IOC order.
 *
 * Adapts a viem `LocalAccount` to the kit's `Signer` and `EvmWallet`
 * interfaces in ~10 lines. Drop-in pattern for any TypeScript backend.
 */
import { config } from 'dotenv'
import { http, type Hex, createWalletClient, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { type EvmWallet, type Signer, createUsdhKit } from 'usdh-kit'

config()

const PRIV_KEY = process.env['PRIV_KEY'] as Hex | undefined
const NETWORK = (process.env['NETWORK'] ?? 'testnet') as 'mainnet' | 'testnet'
const RPC_URL =
  process.env['HYPER_EVM_RPC_URL'] ??
  (NETWORK === 'mainnet'
    ? 'https://rpc.hyperliquid.xyz/evm'
    : 'https://rpc.hyperliquid-testnet.xyz/evm')
const AMOUNT_USDC_EVM = BigInt(process.env['AMOUNT_USDC_EVM'] ?? '1000000')

if (!PRIV_KEY || PRIV_KEY === '0x') {
  console.error('Missing PRIV_KEY in .env. Copy .env.example and fill it in.')
  process.exit(1)
}

const account = privateKeyToAccount(PRIV_KEY)

const hyperEvm = defineChain({
  id: NETWORK === 'mainnet' ? 999 : 998,
  name: NETWORK === 'mainnet' ? 'HyperEVM' : 'HyperEVM Testnet',
  nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
})

const walletClient = createWalletClient({ account, chain: hyperEvm, transport: http() })

const evmWallet: EvmWallet = {
  address: account.address,
  sendTransaction: ({ to, data }) => walletClient.sendTransaction({ to, data }),
}

const signer: Signer = {
  address: account.address,
  // viem's typed-data generics are stricter than the kit's. The runtime
  // shape is identical; cast at the adapter boundary.
  // biome-ignore lint/suspicious/noExplicitAny: viem variance, see above
  signTypedData: (args) => account.signTypedData(args as any),
  signMessage: (message) =>
    account.signMessage({
      message: typeof message === 'string' ? message : { raw: message },
    }),
}

const kit = createUsdhKit({
  network: NETWORK,
  signer,
  evmWallet,
  slippageBps: 30,
  logger: {
    debug: (event, ctx) => console.log(`[debug] ${event}`, ctx ?? ''),
    info: (event, ctx) => console.log(`[info ] ${event}`, ctx ?? ''),
    warn: (event, ctx) => console.warn(`[warn ] ${event}`, ctx ?? ''),
    error: (event, ctx) => console.error(`[error] ${event}`, ctx ?? ''),
  },
})

async function main() {
  console.log(`account: ${account.address}`)
  console.log(`network: ${NETWORK}`)
  console.log(`amount:  ${AMOUNT_USDC_EVM} (USDC smallest unit, 6 decimals)`)

  console.log('\n→ getQuote')
  const quote = await kit.getQuote({ from: 'USDC', amount: AMOUNT_USDC_EVM })
  console.log(`  estimated USDH out: ${quote.estimatedReceived}`)
  console.log(`  midPrice:           ${quote.midPrice}`)
  console.log(`  pair:               ${quote.pair}`)

  console.log('\n→ bridgeToCore')
  const bridge = await kit.bridgeToCore({ asset: 'USDC', amount: AMOUNT_USDC_EVM })
  console.log(`  txHash:     ${bridge.txHash}`)
  console.log(`  creditedAt: ${new Date(bridge.creditedAt).toISOString()}`)

  console.log('\n→ swap')
  const swap = await kit.swap({ from: 'USDC', amount: AMOUNT_USDC_EVM })
  console.log(`  orderId:     ${swap.orderId}`)
  console.log(`  received:    ${swap.received} USDH`)
  console.log(`  spent:       ${swap.spent} USDC`)
  console.log(`  slippageBps: ${swap.slippageBps}`)

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('\nflow failed:', err)
  process.exit(1)
})
