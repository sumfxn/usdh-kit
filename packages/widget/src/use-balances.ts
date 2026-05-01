'use client'

import { useQuery } from '@tanstack/react-query'
import { type SpotMeta, createInfoClient } from '@usdh-kit/sdk'
import { useMemo } from 'react'
import { erc20Abi } from 'viem'
import { useReadContract } from 'wagmi'

import { HYPER_EVM_CHAIN_ID } from './chains.js'
import type { HyperNetwork } from './types.js'

const REFRESH_INTERVAL_MS = 5_000

export interface UsdcBalances {
  evm: bigint | undefined
  evmDecimals: number | undefined
  hc: bigint | undefined
  hcDecimals: number | undefined
  isLoading: boolean
  isRefreshing: boolean
  refetch: () => void
}

interface UsdcTokenInfo {
  evmAddress: `0x${string}`
  evmDecimals: number
  hcWeiDecimals: number
  hcTokenIndex: number
}

function resolveUsdc(meta: SpotMeta): UsdcTokenInfo | null {
  const usdc = meta.tokens.find((t) => t.name === 'USDC')
  if (!usdc?.evmContract?.address) return null
  return {
    evmAddress: usdc.evmContract.address as `0x${string}`,
    evmDecimals: usdc.weiDecimals + (usdc.evmContract.evm_extra_wei_decimals ?? 0),
    hcWeiDecimals: usdc.weiDecimals,
    hcTokenIndex: usdc.index,
  }
}

/**
 * Read the user's USDC balance on both HyperEVM (the bridge source) and
 * HyperCore (where the swap fills). Both refresh on a 5s cadence so the UI
 * reflects an in-flight bridge without manual reloads.
 */
export function useUsdcBalances(
  network: HyperNetwork,
  address: `0x${string}` | undefined,
): UsdcBalances {
  const info = useMemo(() => createInfoClient({ network }), [network])

  const tokenQuery = useQuery({
    queryKey: ['usdh-kit', network, 'usdc-token-info'],
    queryFn: async () => resolveUsdc(await info.spotMeta()),
    staleTime: 5 * 60_000,
  })

  const token = tokenQuery.data ?? null

  const hcQuery = useQuery({
    queryKey: ['usdh-kit', network, 'hc-balance', address ?? ''],
    enabled: Boolean(address && token),
    queryFn: async (): Promise<bigint> => {
      if (!address || !token) return 0n
      const state = await info.spotClearinghouseState(address)
      const row = state.balances.find((b) => b.token === token.hcTokenIndex)
      if (!row) return 0n
      const total = parseHcAmount(row.total, token.hcWeiDecimals)
      const hold = parseHcAmount(row.hold, token.hcWeiDecimals)
      return total > hold ? total - hold : 0n
    },
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })

  const evmRead = useReadContract({
    abi: erc20Abi,
    address: token?.evmAddress,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HYPER_EVM_CHAIN_ID[network],
    query: {
      enabled: Boolean(address && token),
      refetchInterval: REFRESH_INTERVAL_MS,
      refetchOnWindowFocus: true,
    },
  })

  return {
    evm: typeof evmRead.data === 'bigint' ? evmRead.data : undefined,
    evmDecimals: token?.evmDecimals,
    hc: hcQuery.data,
    hcDecimals: token?.hcWeiDecimals,
    isLoading: tokenQuery.isLoading || hcQuery.isLoading || evmRead.isLoading,
    isRefreshing: tokenQuery.isFetching || hcQuery.isFetching || evmRead.isFetching,
    refetch: () => {
      tokenQuery.refetch()
      hcQuery.refetch()
      evmRead.refetch()
    },
  }
}

function parseHcAmount(value: string, weiDecimals: number): bigint {
  const trimmed = value.trim()
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(trimmed)) return 0n
  const [intPart, fracPart = ''] = trimmed.split('.')
  if (fracPart.length > weiDecimals) return 0n
  const padded = fracPart.padEnd(weiDecimals, '0')
  return BigInt(intPart + padded)
}
