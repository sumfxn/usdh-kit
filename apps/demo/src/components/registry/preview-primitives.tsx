import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type {
  GalleryBookLevel,
  GalleryOutcome,
  GalleryPair,
  GallerySnapshot,
} from '../../lib/gallery-data'

export type PreviewSize = 'full' | 'compact'
export type PreviewTone = 'neutral' | 'green' | 'red' | 'amber' | 'blue'

export const fallbackPair: GalleryPair = {
  name: '@230',
  label: 'USDH/USDC',
  index: 230,
  role: 'base',
  mid: '1.0002',
}

export const fallbackOutcome: GalleryOutcome = {
  id: 20,
  name: 'USDH weekly volume clears $5m',
  sides: ['Yes', 'No'],
  coin: '#200',
  sideCoins: ['#200', '#201'],
  sideReads: [
    {
      side: 'Yes',
      coin: '#200',
      probability: 70,
      bestBid: '0.68',
      bestAsk: '0.72',
      depth: '$18.4k',
      source: 'sample',
    },
    {
      side: 'No',
      coin: '#201',
      probability: 34,
      bestBid: '0.32',
      bestAsk: '0.36',
      depth: '$12.1k',
      source: 'sample',
    },
  ],
}

export function PreviewShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 w-full max-w-full overflow-hidden', className)}>{children}</div>
  )
}

export function PreviewHeader({
  icon: Icon,
  title,
  eyebrow,
  right,
}: {
  icon: LucideIcon
  title: string
  eyebrow: string
  right?: ReactNode
}) {
  return (
    <div className="mb-3 flex min-w-0 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <Icon className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-300" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-medium text-neutral-500">{eyebrow}</div>
          <h3 className="truncate text-base font-semibold">{title}</h3>
        </div>
      </div>
      {right}
    </div>
  )
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: PreviewTone
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium',
        tone === 'neutral' &&
          'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-400',
        tone === 'green' &&
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        tone === 'red' && 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
        tone === 'amber' &&
          'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        tone === 'blue' && 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      )}
    >
      {children}
    </span>
  )
}

export function MetricRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: PreviewTone
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="min-w-0 text-neutral-500">{label}</span>
      <span
        className={cn(
          'shrink-0 font-medium text-neutral-900 dark:text-neutral-100',
          /\d/.test(value) && 'tabular-nums',
          tone === 'green' && 'text-emerald-700 dark:text-emerald-300',
          tone === 'red' && 'text-red-700 dark:text-red-300',
          tone === 'amber' && 'text-amber-700 dark:text-amber-300',
          tone === 'blue' && 'text-sky-700 dark:text-sky-300',
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function MetricList({ rows }: { rows: Array<[string, string, PreviewTone?]> }) {
  return (
    <div className="space-y-2">
      {rows.map(([label, value, tone]) => (
        <MetricRow key={label} label={label} value={value} tone={tone} />
      ))}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: PreviewTone
}) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100',
          tone === 'green' && 'text-emerald-700 dark:text-emerald-300',
          tone === 'red' && 'text-red-700 dark:text-red-300',
          tone === 'amber' && 'text-amber-700 dark:text-amber-300',
          tone === 'blue' && 'text-sky-700 dark:text-sky-300',
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function ProgressBar({
  value,
  tone = 'green',
  className,
}: {
  value: number
  tone?: Exclude<PreviewTone, 'neutral'>
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          tone === 'green' && 'bg-emerald-500',
          tone === 'red' && 'bg-red-500',
          tone === 'amber' && 'bg-amber-500',
          tone === 'blue' && 'bg-sky-500',
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function DepthRows({
  title,
  value,
  levels,
  tone,
}: {
  title: string
  value: string
  levels: GalleryBookLevel[]
  tone: 'green' | 'red'
}) {
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-neutral-500">{title}</span>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            tone === 'green'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-red-700 dark:text-red-300',
          )}
        >
          {value}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {levels.slice(0, 3).map((level, index) => (
          <DepthRow key={`${title}-${level.price}-${index}`} level={level} tone={tone} />
        ))}
      </div>
    </div>
  )
}

export function VariantSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

export function SnapshotFreshness({ snapshot }: { snapshot: GallerySnapshot }) {
  const label =
    snapshot.mode === 'sample'
      ? 'offline read'
      : snapshot.freshness === 'stale'
        ? 'cached read'
        : 'mainnet read'
  return <span className="text-xs text-neutral-500">{label}</span>
}

function DepthRow({ level, tone }: { level: GalleryBookLevel; tone: 'green' | 'red' }) {
  const size = Number(level.size.replace(/,/g, ''))
  const width = Number.isFinite(size) ? Math.max(18, Math.min(92, size / 220)) : 40
  return (
    <div className="relative overflow-hidden rounded bg-neutral-50 px-2 py-1.5 text-xs dark:bg-neutral-900">
      <span
        className={cn(
          'absolute inset-y-0 right-0 transition-all duration-300',
          tone === 'green'
            ? 'bg-emerald-100 dark:bg-emerald-950/40'
            : 'bg-red-100 dark:bg-red-950/40',
        )}
        style={{ width: `${width}%` }}
      />
      <span className="relative flex items-center justify-between gap-2">
        <span className="tabular-nums">{level.price}</span>
        <span className="tabular-nums text-neutral-500">{level.size}</span>
      </span>
    </div>
  )
}

export function liquidityScore(pair: GalleryPair, index: number) {
  const mid = Number(pair.mid)
  const base = pair.role === 'base' ? 78 : 54
  const midBoost = Number.isFinite(mid) ? Math.min(18, Math.max(4, Math.log10(mid + 1) * 7)) : 8
  return Math.min(94, Math.round(base + midBoost - index * 4))
}

export function outcomeDisplayName(outcome: GalleryOutcome) {
  if (/^recurring/i.test(outcome.name) || /^binary market/i.test(outcome.name)) {
    return outcomeExampleTitle(outcome.id)
  }
  return outcome.name
}

export function outcomeSubtitle(outcome: GalleryOutcome) {
  const sides = outcome.sides.join(' / ')
  if (/^recurring/i.test(outcome.name)) return sides
  return sides
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card
      className={cn(
        'h-fit min-w-0 w-full max-w-full overflow-hidden border-neutral-200/80 dark:border-neutral-800',
        className,
      )}
    >
      {children}
    </Card>
  )
}

function outcomeExampleTitle(id: number) {
  const examples = [
    'USDH weekly volume clears $5m',
    'HYPE weekly close green',
    'Protocol fee vote passes',
  ]
  return examples[Math.abs(id) % examples.length] ?? `Outcome market #${id}`
}
