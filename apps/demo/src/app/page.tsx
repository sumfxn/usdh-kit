import { ConnectButton } from '../components/ConnectButton'
import { SwapSection } from '../components/SwapSection'

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 py-10 sm:py-16">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-100">usdh-kit</h1>
        <ConnectButton />
      </header>
      <p className="mt-1.5 text-sm text-neutral-400">Swap stables into USDH on Hyperliquid.</p>
      <div className="mt-6">
        <SwapSection />
      </div>
      <footer className="mt-10 flex items-center justify-between text-[11px] text-neutral-600">
        <span>Open source, MIT.</span>
        <a
          href="https://github.com/sumfxn/usdh-kit"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono underline-offset-2 transition hover:text-neutral-400 hover:underline"
        >
          github.com/sumfxn/usdh-kit
        </a>
      </footer>
    </main>
  )
}
