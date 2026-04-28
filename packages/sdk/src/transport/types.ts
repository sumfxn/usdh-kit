import type { Address, Hex } from '../types/hex.js'

export interface SpotToken {
  name: string
  szDecimals: number
  weiDecimals: number
  index: number
  tokenId: Hex
  isCanonical: boolean
  evmContract?: { address: Address; evm_extra_wei_decimals: number } | null
  fullName?: string | null
}

export interface SpotPair {
  name: string
  /** [baseTokenIndex, quoteTokenIndex] */
  tokens: [number, number]
  index: number
  isCanonical: boolean
}

export interface SpotMeta {
  universe: SpotPair[]
  tokens: SpotToken[]
}

export interface L2Level {
  /** Price as decimal string. */
  px: string
  /** Size as decimal string. */
  sz: string
  /** Number of orders at this level. */
  n: number
}

export interface L2Book {
  coin: string
  /** Server timestamp, ms since epoch. */
  time: number
  /** [bids, asks], best-first. */
  levels: [L2Level[], L2Level[]]
}
