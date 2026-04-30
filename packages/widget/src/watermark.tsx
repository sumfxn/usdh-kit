const KIT_URL = 'https://github.com/sumfxn/usdh-kit'

export function Watermark() {
  return (
    <p className="text-[11px] text-usdh-text-soft">
      <a
        href={KIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-usdh-text-muted"
      >
        Powered by <span className="font-mono text-usdh-text-muted">usdh-kit</span>
      </a>
    </p>
  )
}
