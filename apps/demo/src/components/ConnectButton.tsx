'use client'

import { ConnectKitButton } from 'connectkit'

export function ConnectButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address, ensName }) => {
        if (isConnecting) {
          return (
            <span className="inline-flex h-8 items-center rounded-md border border-neutral-200 bg-neutral-50 px-3 text-[11px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
              Connecting…
            </span>
          )
        }
        if (!isConnected) {
          return (
            <button
              type="button"
              onClick={show}
              className="inline-flex h-8 items-center rounded-md bg-neutral-900 px-3.5 text-[11px] font-medium text-neutral-100 transition hover:bg-black dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
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
            className="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 text-[11px] text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
            aria-label="Wallet menu"
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-500/90 dark:bg-emerald-400/80"
              aria-hidden="true"
            />
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
