export type HyperNetwork = 'mainnet' | 'testnet'

export type WidgetTheme = 'dark' | 'light' | 'auto'

export interface SwapResultPayload {
  orderId: string
  receivedUsdh: bigint
  txHash?: `0x${string}`
}
