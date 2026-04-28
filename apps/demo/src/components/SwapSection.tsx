'use client'

import { useState } from 'react'

import type { HyperNetwork } from '../lib/chains'
import { ConnectionStatus } from './ConnectionStatus'
import { SwapPanel } from './SwapPanel'

export function SwapSection() {
  const [network, setNetwork] = useState<HyperNetwork>('testnet')
  return (
    <>
      <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/50 p-8">
        <ConnectionStatus />
        <div className="inline-flex rounded-lg border border-neutral-800 p-1 text-xs">
          <button
            type="button"
            onClick={() => setNetwork('testnet')}
            className={`rounded px-3 py-1 transition ${network === 'testnet' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Testnet
          </button>
          <button
            type="button"
            onClick={() => setNetwork('mainnet')}
            className={`rounded px-3 py-1 transition ${network === 'mainnet' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Mainnet
          </button>
        </div>
      </div>
      <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/50 p-8">
        <SwapPanel network={network} />
      </section>
    </>
  )
}
