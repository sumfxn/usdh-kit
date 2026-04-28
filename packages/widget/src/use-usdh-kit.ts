'use client'

import { type EvmWallet, type Signer, createUsdhKit } from '@usdh-kit/sdk'
import { useAccount, useSignMessage, useSignTypedData, useWalletClient } from 'wagmi'

import type { HyperNetwork } from './types.js'

export function useUsdhKit(network: HyperNetwork = 'mainnet') {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { signTypedDataAsync } = useSignTypedData()
  const { signMessageAsync } = useSignMessage()

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
  }

  return createUsdhKit({
    network,
    signer,
    evmWallet,
    slippageBps: 30,
  })
}
