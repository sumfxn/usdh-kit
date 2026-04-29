export type HyperNetwork = 'mainnet' | 'testnet'

/**
 * Theme mode for the widget.
 *
 * - `dark` — force dark palette
 * - `light` — force light palette
 * - `auto` — follow the user's system preference via `prefers-color-scheme`
 *
 * Defaults to `auto` when the prop is omitted.
 */
export type WidgetTheme = 'dark' | 'light' | 'auto'

export interface SwapResultPayload {
  orderId: string
  receivedUsdh: bigint
  txHash?: `0x${string}`
}
