'use client'

import { type EvmWallet, type Signer, type UsdhKit, createUsdhKit } from '@usdh-kit/sdk'
import { useMemo } from 'react'
import {
  useAccount,
  usePublicClient,
  useSignMessage,
  useSignTypedData,
  useWalletClient,
} from 'wagmi'

import { HYPER_EVM_CHAIN_ID } from './chains.js'
import type { HyperNetwork } from './types.js'

export function useUsdhKit(network: HyperNetwork): UsdhKit | null {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: HYPER_EVM_CHAIN_ID[network] })
  const { signTypedDataAsync } = useSignTypedData()
  const { signMessageAsync } = useSignMessage()

  return useMemo<UsdhKit | null>(() => {
    if (!address || !walletClient) return null

    const signer: Signer = {
      address,
      // biome-ignore lint/suspicious/noExplicitAny: viem typed-data variance
      signTypedData: (args) => signTypedDataAsync(args as any),
      signMessage: (message) =>
        signMessageAsync({
          message: typeof message === 'string' ? message : { raw: message },
        }),
    }

    const evmWallet: EvmWallet = {
      address,
      sendTransaction: ({ to, data }) => walletClient.sendTransaction({ to, data }),
      waitForTransactionReceipt: async (hash) => {
        await publicClient?.waitForTransactionReceipt({ hash })
      },
    }

    return createUsdhKit({ network, signer, evmWallet, slippageBps: 30 })
  }, [network, address, walletClient, publicClient, signTypedDataAsync, signMessageAsync])
}
