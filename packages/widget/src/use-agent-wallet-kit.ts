'use client'

import {
  type Address,
  type EvmWallet,
  type Signer,
  type UsdhKit,
  approveAgent,
  createUsdhKit,
} from '@usdh-kit/sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { HYPER_EVM_CHAIN_ID } from './chains.js'
import type { HyperNetwork } from './types.js'

const STORAGE_PREFIX = 'usdh-kit:agent-session:'
const SESSION_VERSION = 1
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/

type AgentSessionRecord = {
  version: typeof SESSION_VERSION
  network: HyperNetwork
  accountAddress: Address
  agentName: string
  privateKey: `0x${string}`
  createdAt: number
}

export interface AgentWalletKitState {
  kit: UsdhKit | null
  sessionReady: boolean
  isApprovingSession: boolean
  enableTradingSession: () => Promise<void>
}

export function useAgentWalletKit(network: HyperNetwork): AgentWalletKitState {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: HYPER_EVM_CHAIN_ID[network] })
  const accountAddress = address ? normalizeAddress(address) : null
  const storageKey =
    accountAddress === null ? null : `${STORAGE_PREFIX}${network}:${accountAddress.toLowerCase()}`
  const [record, setRecord] = useState<AgentSessionRecord | null>(() => loadSession(storageKey))
  const [isApprovingSession, setIsApprovingSession] = useState(false)

  useEffect(() => {
    cleanupOtherSessions(storageKey)
    setRecord(loadSession(storageKey))
  }, [storageKey])

  const masterSigner = useMemo<Signer | null>(() => {
    if (!accountAddress || !walletClient) return null
    return {
      address: accountAddress,
      signTypedData: (args) =>
        walletClient.signTypedData({
          account: accountAddress,
          // biome-ignore lint/suspicious/noExplicitAny: viem typed-data variance
          ...(args as any),
        }),
      signMessage: (message) =>
        walletClient.signMessage({
          account: accountAddress,
          message: typeof message === 'string' ? message : { raw: message },
        }),
    }
  }, [accountAddress, walletClient])

  const agentSigner = useMemo<Signer | null>(() => {
    if (!record || !accountAddress || record.network !== network) return null
    if (record.accountAddress.toLowerCase() !== accountAddress.toLowerCase()) return null
    let account: ReturnType<typeof privateKeyToAccount>
    try {
      account = privateKeyToAccount(record.privateKey)
    } catch {
      removeSession(storageKey)
      return null
    }
    return {
      address: normalizeAddress(account.address),
      // biome-ignore lint/suspicious/noExplicitAny: viem typed-data variance
      signTypedData: (args) => account.signTypedData(args as any),
      signMessage: (message) =>
        account.signMessage({ message: typeof message === 'string' ? message : { raw: message } }),
    }
  }, [record, accountAddress, network, storageKey])

  const enableTradingSession = useCallback(async () => {
    if (!masterSigner || !storageKey || !accountAddress) return
    setIsApprovingSession(true)
    try {
      const privateKey = generatePrivateKey()
      const account = privateKeyToAccount(privateKey)
      const agentName = agentNameFor(network)
      await approveAgent({
        network,
        signer: masterSigner,
        agentAddress: normalizeAddress(account.address),
        agentName,
        signatureChainId: HYPER_EVM_CHAIN_ID[network],
      })
      const nextRecord: AgentSessionRecord = {
        version: SESSION_VERSION,
        network,
        accountAddress,
        agentName,
        privateKey,
        createdAt: Date.now(),
      }
      saveSession(storageKey, nextRecord)
      setRecord(nextRecord)
    } finally {
      setIsApprovingSession(false)
    }
  }, [masterSigner, storageKey, accountAddress, network])

  const kit = useMemo<UsdhKit | null>(() => {
    if (!accountAddress || !walletClient || !masterSigner) return null
    const signer = agentSigner ?? masterSigner
    const evmWallet: EvmWallet = {
      address: accountAddress,
      sendTransaction: ({ to, data }) => walletClient.sendTransaction({ to, data }),
      waitForTransactionReceipt: async (hash) => {
        await publicClient?.waitForTransactionReceipt({ hash })
      },
    }
    return createUsdhKit({
      network,
      signer,
      accountAddress,
      evmWallet,
      slippageBps: 30,
    })
  }, [network, accountAddress, walletClient, masterSigner, agentSigner, publicClient])

  return {
    kit,
    sessionReady: agentSigner !== null,
    isApprovingSession,
    enableTradingSession,
  }
}

function agentNameFor(network: HyperNetwork): string {
  return `usdh-kit-${network}`
}

function loadSession(storageKey: string | null): AgentSessionRecord | null {
  if (storageKey === null || typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AgentSessionRecord>
    if (parsed.version !== SESSION_VERSION) return null
    if (!parsed.network || !parsed.accountAddress || !parsed.privateKey) {
      return null
    }
    if (!PRIVATE_KEY_PATTERN.test(parsed.privateKey)) return null
    if (!parsed.agentName || typeof parsed.createdAt !== 'number') return null
    return parsed as AgentSessionRecord
  } catch {
    window.sessionStorage.removeItem(storageKey)
    return null
  }
}

function removeSession(storageKey: string | null): void {
  if (storageKey === null || typeof window === 'undefined') return
  window.sessionStorage.removeItem(storageKey)
}

function saveSession(storageKey: string, record: AgentSessionRecord): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(record))
  } catch {
    // Keep the approved agent in React state for this page lifetime only.
  }
}

function cleanupOtherSessions(activeStorageKey: string | null): void {
  if (typeof window === 'undefined') return
  for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
    const key = window.sessionStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX) && key !== activeStorageKey) {
      window.sessionStorage.removeItem(key)
    }
  }
}

function normalizeAddress(address: `0x${string}`): Address {
  return address.toLowerCase() as Address
}
