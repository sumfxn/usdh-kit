export function ErrorAlert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-usdh-border bg-usdh-surface/60 px-3 py-2 text-[11px] text-usdh-text"
    >
      {message}
    </p>
  )
}
