'use client'

import { type EvmWallet, type Signer, type UsdhKit, createUsdhKit } from '@usdh-kit/sdk'
import { useMemo } from 'react'
import { useAccount, useWalletClient } from 'wagmi'

import type { HyperNetwork } from './types.js'

declare const process: { env?: { NODE_ENV?: string } } | undefined

export function useUsdhKit(network: HyperNetwork): UsdhKit | null {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  return useMemo<UsdhKit | null>(() => {
    if (!address || !walletClient) return null

    const signer: Signer = {
      address,
      signTypedData: (args) =>
        withWalletErrorLogging('signTypedData', () =>
          walletClient.signTypedData({
            account: address,
            ...args,
          } as Parameters<typeof walletClient.signTypedData>[0]),
        ),
      signMessage: (message) =>
        withWalletErrorLogging('signMessage', () =>
          walletClient.signMessage({
            account: address,
            message: typeof message === 'string' ? message : { raw: message },
          }),
        ),
    }

    const evmWallet: EvmWallet = {
      address,
      sendTransaction: ({ to, data }) => walletClient.sendTransaction({ to, data }),
    }

    return createUsdhKit({ network, signer, evmWallet, slippageBps: 30 })
  }, [network, address, walletClient])
}

async function withWalletErrorLogging<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    logWalletError(operation, err)
    throw err
  }
}

function logWalletError(operation: string, err: unknown) {
  if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'development') return
  console.warn(`[usdh-kit] wallet ${operation} failed`, summarizeWalletError(err))
}

function summarizeWalletError(err: unknown) {
  return {
    error: summarizeErrorShape(err),
    causeChain: summarizeCauseChain(err),
  }
}

function summarizeErrorShape(err: unknown) {
  if (!isObjectLike(err)) return { message: typeof err === 'string' ? firstLine(err) : undefined }
  const shape = err as { name?: unknown; code?: unknown; message?: unknown }
  return {
    name: typeof shape.name === 'string' ? shape.name : undefined,
    code: typeof shape.code === 'string' || typeof shape.code === 'number' ? shape.code : undefined,
    message: typeof shape.message === 'string' ? firstLine(shape.message) : undefined,
  }
}

function getCause(err: unknown): unknown {
  if (!isObjectLike(err)) return undefined
  return (err as { cause?: unknown }).cause
}

function summarizeCauseChain(err: unknown) {
  const chain: unknown[] = []
  let cursor = getCause(err)
  for (let depth = 0; cursor !== undefined && depth < 5; depth++) {
    chain.push(summarizeErrorShape(cursor))
    cursor = getCause(cursor)
  }
  return chain
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
}

function firstLine(message: string): string {
  const idx = message.indexOf('\n')
  return idx === -1 ? message : message.slice(0, idx)
}
