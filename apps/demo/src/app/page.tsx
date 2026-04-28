import { ConnectButton } from '../components/ConnectButton'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { SwapPanel } from '../components/SwapPanel'

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">usdh-kit</h1>
          <p className="mt-3 text-neutral-400">Swap stables into USDH on Hyperliquid.</p>
        </div>
        <ConnectButton />
      </header>
      <section className="mt-12 rounded-2xl border border-neutral-800 bg-neutral-950/50 p-8">
        <ConnectionStatus />
      </section>
      <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/50 p-8">
        <SwapPanel />
      </section>
    </main>
  )
}
