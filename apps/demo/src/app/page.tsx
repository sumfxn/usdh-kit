import { ConnectButton } from '../components/ConnectButton'
import { SwapSection } from '../components/SwapSection'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 py-6 sm:py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          usdh-kit
        </h1>
        <ConnectButton />
      </header>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Migrate remaining USDH back to USDC on Hyperliquid.
      </p>
      <div className="mt-5">
        <SwapSection />
      </div>
      <footer className="mt-5 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-600">
        <span className="flex items-center gap-3">
          <a
            href="https://x.com/Yaugourt"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono underline-offset-2 transition hover:text-neutral-700 hover:underline dark:hover:text-neutral-400"
          >
            Yaugourt
          </a>
          <span className="font-mono">+</span>
          <a
            href="https://x.com/sumfxn"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono underline-offset-2 transition hover:text-neutral-700 hover:underline dark:hover:text-neutral-400"
          >
            Sumfxn
          </a>
        </span>
        <a
          href="https://github.com/sumfxn/usdh-kit"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono underline-offset-2 transition hover:text-neutral-700 dark:hover:text-neutral-400 hover:underline"
        >
          github.com/sumfxn/usdh-kit
        </a>
      </footer>
    </main>
  )
}
