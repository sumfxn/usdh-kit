'use client'

import { useQuery } from '@tanstack/react-query'
import { type SpotMeta, createInfoClient, getHyperEvmNativeUsdcAddress } from '@usdh-kit/sdk'
import { useMemo } from 'react'
import { erc20Abi } from 'viem'
import { useReadContract } from 'wagmi'

import { HYPER_EVM_CHAIN_ID } from './chains.js'
import type { HyperNetwork } from './types.js'

const REFRESH_INTERVAL_MS = 12_000

export interface UsdcBalances {
  evm: bigint | undefined
  evmDecimals: number | undefined
  hc: bigint | undefined
  hcDecimals: number | undefined
  evmUsdh: bigint | undefined
  evmUsdhDecimals: number | undefined
  hcUsdh: bigint | undefined
  hcUsdhDecimals: number | undefined
  isLoading: boolean
  refetch: () => void
}

interface StableTokenInfo {
  usdc: TokenInfo | null
  usdh: TokenInfo | null
}

interface TokenInfo {
  evmAddress: `0x${string}` | undefined
  evmDecimals: number | undefined
  hcWeiDecimals: number
  hcTokenIndex: number
}

function resolveStableTokens(network: HyperNetwork, meta: SpotMeta): StableTokenInfo {
  return {
    usdc: resolveToken(meta, 'USDC', getHyperEvmNativeUsdcAddress(network)),
    usdh: resolveToken(meta, 'USDH'),
  }
}

function resolveToken(
  meta: SpotMeta,
  name: 'USDC' | 'USDH',
  evmAddressOverride?: `0x${string}`,
): TokenInfo | null {
  const token = meta.tokens.find((t) => t.name === name)
  if (!token) return null
  return {
    evmAddress: evmAddressOverride ?? (token.evmContract?.address as `0x${string}` | undefined),
    evmDecimals:
      token.evmContract === undefined || token.evmContract === null
        ? undefined
        : token.weiDecimals + (token.evmContract.evm_extra_wei_decimals ?? 0),
    hcWeiDecimals: token.weiDecimals,
    hcTokenIndex: token.index,
  }
}

/**
 * Read the user's USDC balance on both HyperEVM (the bridge source) and
 * HyperCore (where the swap fills). Both refresh on a 12s cadence so the UI
 * reflects an in-flight bridge without manual reloads.
 */
export function useUsdcBalances(
  network: HyperNetwork,
  address: `0x${string}` | undefined,
): UsdcBalances {
  const info = useMemo(() => createInfoClient({ network }), [network])

  const tokenQuery = useQuery({
    queryKey: ['usdh-kit', network, 'stable-token-info'],
    queryFn: async () => resolveStableTokens(network, await info.spotMeta()),
    staleTime: 5 * 60_000,
  })

  const usdc = tokenQuery.data?.usdc ?? null
  const usdh = tokenQuery.data?.usdh ?? null

  const hcQuery = useQuery({
    queryKey: ['usdh-kit', network, 'hc-stable-balances', address ?? ''],
    enabled: Boolean(address && usdc),
    queryFn: async (): Promise<{ usdc: bigint; usdh: bigint | undefined }> => {
      if (!address || !usdc) return { usdc: 0n, usdh: undefined }
      const state = await info.spotClearinghouseState(address)
      return {
        usdc: readHcBalance(state.balances, usdc),
        usdh: usdh ? readHcBalance(state.balances, usdh) : undefined,
      }
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  })

  const evmUsdcRead = useReadContract({
    abi: erc20Abi,
    address: usdc?.evmAddress,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HYPER_EVM_CHAIN_ID[network],
    query: {
      enabled: Boolean(address && usdc?.evmAddress),
      refetchInterval: REFRESH_INTERVAL_MS,
    },
  })

  const evmUsdhRead = useReadContract({
    abi: erc20Abi,
    address: usdh?.evmAddress,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HYPER_EVM_CHAIN_ID[network],
    query: {
      enabled: Boolean(address && usdh?.evmAddress),
      refetchInterval: REFRESH_INTERVAL_MS,
    },
  })

  return {
    evm: typeof evmUsdcRead.data === 'bigint' ? evmUsdcRead.data : undefined,
    evmDecimals: usdc?.evmDecimals,
    hc: hcQuery.data?.usdc,
    hcDecimals: usdc?.hcWeiDecimals,
    evmUsdh: typeof evmUsdhRead.data === 'bigint' ? evmUsdhRead.data : undefined,
    evmUsdhDecimals: usdh?.evmDecimals,
    hcUsdh: hcQuery.data?.usdh,
    hcUsdhDecimals: usdh?.hcWeiDecimals,
    isLoading:
      tokenQuery.isLoading || hcQuery.isLoading || evmUsdcRead.isLoading || evmUsdhRead.isLoading,
    refetch: () => {
      hcQuery.refetch()
      evmUsdcRead.refetch()
      evmUsdhRead.refetch()
    },
  }
}

function readHcBalance(
  rows: Array<{ token: number; total: string; hold: string }>,
  token: TokenInfo,
): bigint {
  const row = rows.find((b) => b.token === token.hcTokenIndex)
  if (!row) return 0n
  const total = parseHcAmount(row.total, token.hcWeiDecimals)
  const hold = parseHcAmount(row.hold, token.hcWeiDecimals)
  return total > hold ? total - hold : 0n
}

function parseHcAmount(value: string, weiDecimals: number): bigint {
  const trimmed = value.trim()
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(trimmed)) return 0n
  const [intPart, fracPart = ''] = trimmed.split('.')
  if (fracPart.length > weiDecimals) return 0n
  const padded = fracPart.padEnd(weiDecimals, '0')
  return BigInt(intPart + padded)
}
