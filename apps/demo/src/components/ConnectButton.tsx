'use client'

import { ConnectKitButton } from 'connectkit'

export function ConnectButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address, ensName }) => {
        if (isConnecting) {
          return (
            <span className="inline-flex h-8 items-center rounded-md border border-neutral-800 bg-neutral-900/60 px-3 text-[11px] text-neutral-400">
              Connecting…
            </span>
          )
        }
        if (!isConnected) {
          return (
            <button
              type="button"
              onClick={show}
              className="inline-flex h-8 items-center rounded-md bg-neutral-100 px-3.5 text-[11px] font-medium text-neutral-900 transition hover:bg-white"
            >
              Connect wallet
            </button>
          )
        }
        const label = ensName ?? truncate(address)
        return (
          <button
            type="button"
            onClick={show}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 text-[11px] text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900"
            aria-label="Wallet menu"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" aria-hidden="true" />
            <span className="font-mono">{label}</span>
          </button>
        )
      }}
    </ConnectKitButton.Custom>
  )
}

function truncate(addr: string | undefined): string {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
