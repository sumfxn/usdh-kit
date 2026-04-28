export function formatUnits(amount: bigint, decimals: number): string {
  const negative = amount < 0n
  const abs = negative ? -amount : amount
  const factor = 10n ** BigInt(decimals)
  const intPart = abs / factor
  const fracPart = abs % factor
  if (fracPart === 0n) return `${negative ? '-' : ''}${intPart}`
  const fracStr = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${intPart}.${fracStr}`
}

export function parseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim()
  if (trimmed === '' || !/^-?\d*(?:\.\d*)?$/.test(trimmed)) {
    throw new Error(`invalid decimal: ${value}`)
  }
  const negative = trimmed.startsWith('-')
  const stripped = negative ? trimmed.slice(1) : trimmed
  const [intPart = '0', fracPart = ''] = stripped.split('.')
  if (fracPart.length > decimals) {
    throw new Error(`too many decimals (max ${decimals}): ${value}`)
  }
  const padded = fracPart.padEnd(decimals, '0')
  const out = BigInt((intPart || '0') + padded)
  return negative ? -out : out
}
