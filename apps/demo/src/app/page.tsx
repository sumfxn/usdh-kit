import { ConnectButton } from '../components/ConnectButton'
import { SwapSection } from '../components/SwapSection'

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">usdh-kit</h1>
          <p className="mt-2 text-neutral-400 sm:mt-3">Swap stables into USDH on Hyperliquid.</p>
        </div>
        <ConnectButton />
      </header>
      <div className="mt-10 sm:mt-12">
        <SwapSection />
      </div>
      <footer className="mt-16 flex justify-between text-xs text-neutral-600">
        <span>Open source, MIT.</span>
        <a
          href="https://github.com/sumfxn/usdh-kit"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-neutral-400"
        >
          github.com/sumfxn/usdh-kit
        </a>
      </footer>
    </main>
  )
}
