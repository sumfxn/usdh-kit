import { formatUnits } from './format.js'

const RECEIVE_DECIMALS = 4

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

/**
 * Scale a bigint amount by a difference of decimal places. Positive diff
 * multiplies, negative divides. Used to translate between display units
 * (USDC at 6 dp) and chain-native units (HC weiDecimals, EVM extra dp).
 */
export function scaleAmount(amount: bigint, decimalsDiff: number): bigint {
  if (decimalsDiff === 0) return amount
  if (decimalsDiff > 0) return amount * 10n ** BigInt(decimalsDiff)
  return amount / 10n ** BigInt(-decimalsDiff)
}

/**
 * Format an amount for the receive headline: at most `RECEIVE_DECIMALS`
 * fractional digits with trailing zeros stripped. Avoids long
 * 1.000000-style strings on stable swaps.
 */
export function trimReceive(amount: bigint, fromDecimals: number): string {
  const formatted = formatUnits(amount, fromDecimals)
  const dot = formatted.indexOf('.')
  if (dot === -1) return formatted
  const cap = Math.min(formatted.length, dot + 1 + RECEIVE_DECIMALS)
  return formatted.slice(0, cap).replace(/\.?0+$/, (m) => (m === '.' ? '' : m))
}

/** Wallet-side balance formatter — falls back to em dash when unloaded. */
export function formatBalance(amount: bigint | undefined, decimals: number | undefined): string {
  if (amount === undefined || decimals === undefined) return '—'
  if (amount === 0n) return '0'
  return trimReceive(amount, decimals)
}

/** USDC and USDH are USD-pegged stables, so the amount is the USD value at parity. */
export function formatUsd(amount: bigint, decimals: number): string {
  const factor = 10n ** BigInt(decimals)
  const intPart = amount / factor
  const fracPart = amount % factor
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const cents = (fracPart * 100n) / factor
  return `≈ $${intStr}.${cents.toString().padStart(2, '0')}`
}
