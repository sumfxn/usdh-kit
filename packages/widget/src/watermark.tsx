import { LiquidTerminalMark, SentralMark } from './icons.js'

const KIT_URL = 'https://github.com/sumfxn/usdh-kit'
const SENTRAL_URL = 'https://sentral.cash'
const LIQUIDTERMINAL_URL = 'https://liquidterminal.xyz'

export function Watermark() {
  return (
    <p className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
      <a
        href={KIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-neutral-300"
      >
        Powered by <span className="font-mono text-neutral-300">usdh-kit</span>
      </a>
      <span className="flex items-center gap-2.5">
        <a
          href={SENTRAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Sentral"
          title="Sentral"
          className="flex h-4 items-center text-neutral-200 opacity-50 transition hover:opacity-100"
        >
          <SentralMark />
        </a>
        <a
          href={LIQUIDTERMINAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LiquidTerminal"
          title="LiquidTerminal"
          className="flex h-4 items-center opacity-50 transition hover:opacity-100"
        >
          <LiquidTerminalMark />
        </a>
      </span>
    </p>
  )
}
