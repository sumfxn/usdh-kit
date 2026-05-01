'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { type ReactNode, useState } from 'react'
import { WagmiProvider } from 'wagmi'

import { wagmiConfig } from '../lib/wagmi'
import { ClientLogBridge } from './ClientLogBridge'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ClientLogBridge />
        <ConnectKitProvider mode="dark">{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
