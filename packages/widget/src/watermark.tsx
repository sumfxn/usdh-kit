import { LiquidTerminalMark, SentralMark } from './icons.js'

const KIT_URL = 'https://github.com/sumfxn/usdh-kit'
const SENTRAL_X_URL = 'https://x.com/sentralcash'
const LIQUIDTERMINAL_X_URL = 'https://x.com/liquidterminal'

export function Watermark() {
  return (
    <p className="flex items-center justify-between gap-2 text-[11px] text-usdh-text-soft">
      <a
        href={KIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-usdh-text-muted"
      >
        Powered by <span className="font-mono text-usdh-text-muted">usdh-kit</span>
      </a>
      <span className="flex items-center gap-2.5">
        <a
          href={SENTRAL_X_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Sentral on X"
          title="Sentral"
          className="flex h-4 items-center text-usdh-text opacity-40 transition hover:opacity-100"
        >
          <SentralMark />
        </a>
        <a
          href={LIQUIDTERMINAL_X_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LiquidTerminal on X"
          title="LiquidTerminal"
          className="flex h-4 items-center text-usdh-text opacity-40 transition hover:opacity-100"
        >
          <LiquidTerminalMark />
        </a>
      </span>
    </p>
  )
}
