import { InvalidInputError, NetworkError } from './errors.js'
import type { L2Book } from './transport/types.js'

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

/**
 * Parse a decimal string (e.g. "1.0001") into a bigint scaled by 10^decimals.
 * Throws InvalidInputError on malformed input.
 */
export function parseDecimal(s: string, decimals: number): bigint {
  if (!DECIMAL_PATTERN.test(s)) {
    throw new InvalidInputError(`invalid decimal: ${s}`)
  }
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new InvalidInputError('decimals must be a non-negative integer')
  }
  const [intPartRaw, fracPart = ''] = s.split('.')
  const intPart = intPartRaw ?? '0'
  const trimmedFrac = fracPart.slice(0, decimals)
  const padded = trimmedFrac.padEnd(decimals, '0')
  return BigInt(intPart + padded)
}

/**
 * Compute the mid-price of an L2 book as a bigint scaled by 10^18.
 * Throws NetworkError if the book is missing a side.
 */
export function midPrice18(book: L2Book): bigint {
  const [bids, asks] = book.levels
  const bestBid = bids[0]
  const bestAsk = asks[0]
  if (!bestBid || !bestAsk) {
    throw new NetworkError(`orderbook ${book.coin} is missing a side`)
  }
  const bidBig = parseDecimal(bestBid.px, 18)
  const askBig = parseDecimal(bestAsk.px, 18)
  if (bidBig > askBig) {
    throw new NetworkError(`crossed book on ${book.coin}`)
  }
  return (bidBig + askBig) / 2n
}

const TEN_18 = 10n ** 18n

/**
 * Convert a source-token amount (in source's smallest unit) to the
 * received target-token amount, given a quote-per-base price scaled to 18d.
 *
 * For USDC (source) -> USDH (target) on a `USDH/USDC` pair:
 *  - `pricePerBase18` is USDC per USDH in 18d (the orderbook price)
 *  - returned amount is in target-token smallest unit, same decimals as source
 *
 * Assumes source and target share the same on-chain decimals (true for
 * USDC and USDH stablecoins on Hyperliquid spot).
 */
export function applyPriceInverse(amount: bigint, pricePerBase18: bigint): bigint {
  if (pricePerBase18 <= 0n) {
    throw new InvalidInputError('price must be positive')
  }
  return (amount * TEN_18) / pricePerBase18
}

/**
 * Format a fixed-point bigint as a decimal string with no trailing zeros.
 * `formatDecimal(1_000_100n, 6)` -> "1.0001". Returns "0" for zero.
 * If `maxFracDigits` is provided, the fractional part is truncated.
 */
export function formatDecimal(value: bigint, decimals: number, maxFracDigits?: number): string {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new InvalidInputError('decimals must be a non-negative integer')
  }
  if (maxFracDigits !== undefined && (maxFracDigits < 0 || !Number.isInteger(maxFracDigits))) {
    throw new InvalidInputError('maxFracDigits must be a non-negative integer')
  }
  if (value < 0n) {
    return `-${formatDecimal(-value, decimals, maxFracDigits)}`
  }
  if (value === 0n) return '0'
  if (decimals === 0) return value.toString()
  const padded = value.toString().padStart(decimals + 1, '0')
  const intPart = padded.slice(0, -decimals)
  let fracPart = padded.slice(-decimals)
  if (maxFracDigits !== undefined && fracPart.length > maxFracDigits) {
    fracPart = fracPart.slice(0, maxFracDigits)
  }
  fracPart = fracPart.replace(/0+$/, '')
  return fracPart === '' ? intPart : `${intPart}.${fracPart}`
}
