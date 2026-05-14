'use client'

import { ArrowUpRight, BookOpen, CheckCircle2, Coins, ListChecks, WalletCards } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { Panel, PreviewShell, ProgressBar } from '../preview-primitives'

export interface OutcomeSideQuote {
  label: string
  coin: string
  probability: number | null
  bestBid?: string
  bestAsk?: string
  depth?: string
}

export type OutcomeSideIndex = 0 | 1

export interface OutcomeEventData {
  id: number | string
  title: string
  subtitle: string
  sides: [OutcomeSideQuote, OutcomeSideQuote]
}

export interface OutcomePositionData {
  market: string
  side: string
  coin: string
  position: string
  mark: string
  state: 'held' | 'watch' | 'settled' | 'redeemable'
}

export interface OutcomeBookRow {
  price: string
  size: string
  depthPct: number
}

export interface OutcomeOrderBookSideLevels {
  bids: OutcomeBookRow[]
  asks: OutcomeBookRow[]
}

export function OutcomeLoadingCard() {
  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[640px]">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3 w-28 rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-5 w-64 max-w-full rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-3 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="h-8 w-8 rounded-md bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="h-24 rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/45" />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="h-24 rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/45" />
            <div className="h-24 rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/45" />
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

export function OutcomeEventCard({
  event,
  compact,
  showBookContext,
  selectedSideIndex,
  onSideChange,
}: {
  event: OutcomeEventData
  compact?: boolean
  showBookContext?: boolean
  selectedSideIndex?: OutcomeSideIndex
  onSideChange?: (quote: OutcomeSideQuote, index: OutcomeSideIndex) => void
}) {
  const [internalSideIndex, setInternalSideIndex] = useState<OutcomeSideIndex>(0)
  const sideIndex = selectedSideIndex ?? internalSideIndex
  const selected = event.sides[sideIndex] ?? event.sides[0]
  const [yes, no] = event.sides
  const handleSideChange = (index: OutcomeSideIndex) => {
    setInternalSideIndex(index)
    onSideChange?.(event.sides[index], index)
  }

  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[640px]">
        <CardContent className={cn('space-y-4 p-4', !compact && 'sm:p-5')}>
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                <Coins className="h-3.5 w-3.5" />
                <span>Outcome event</span>
                <span className="tabular-nums">#{event.id}</span>
              </div>
              <h3 className="mt-2 text-lg font-semibold leading-6 text-balance">{event.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{event.subtitle}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Open event"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs text-neutral-500">Selected side</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums">
                  {probabilityLabel(selected.probability)}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">{selected.label}</div>
                <div className="mt-1 tabular-nums text-neutral-500">
                  {priceLabel(selected.bestAsk)}
                </div>
              </div>
            </div>
            <ProgressBar
              value={selected.probability ?? 0}
              tone={sideIndex === 0 ? 'green' : 'red'}
              className="mt-4 h-2"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[yes, no].map((quote, index) => (
              <SideQuoteButton
                key={quote.coin}
                quote={quote}
                active={index === sideIndex}
                tone={index === 0 ? 'green' : 'red'}
                onClick={() => handleSideChange(index as OutcomeSideIndex)}
              />
            ))}
          </div>

          {showBookContext ? (
            <div className="grid gap-2 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800 sm:grid-cols-3">
              <BookCell label="coin" value={selected.coin} />
              <BookCell label="top book" value={bookPriceLabel(selected)} />
              <BookCell label="spread" value={spreadLabel(selected)} />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-200 pt-3 text-xs text-neutral-500 dark:border-neutral-800">
              <span>No wallet write</span>
              <span>Side coin resolved</span>
              <span>Feed-ready</span>
            </div>
          )}
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

export function OutcomeMarketRows({
  events,
  selectedId,
  onSelect,
}: {
  events: OutcomeEventData[]
  selectedId: number | string
  onSelect: (id: number | string) => void
}) {
  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[760px]">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-neutral-500" />
              Outcome market rows
            </div>
            <div className="hidden text-xs text-neutral-500 sm:block">Read-only list pattern</div>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {events.slice(0, 4).map((event) => (
              <button
                key={event.id}
                type="button"
                aria-pressed={event.id === selectedId}
                aria-label={`Select ${event.title}`}
                onClick={() => onSelect(event.id)}
                className={cn(
                  'grid w-full gap-3 px-4 py-3 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_96px_96px_72px] sm:items-center',
                  event.id === selectedId
                    ? 'bg-neutral-50 dark:bg-neutral-900/45'
                    : 'hover:bg-neutral-50/70 dark:hover:bg-neutral-900/30',
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{event.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                    <span>{event.subtitle}</span>
                    <span className="hidden sm:inline">-</span>
                    <span className="tabular-nums">#{event.id}</span>
                  </div>
                </div>
                <SmallQuote quote={event.sides[0]} tone="green" />
                <SmallQuote quote={event.sides[1]} tone="red" />
                <div className="hidden text-right text-xs font-medium text-neutral-500 sm:block">
                  details
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

export function OutcomeOddsSelector({
  event,
  disabled,
  value,
  onValueChange,
}: {
  event: OutcomeEventData
  disabled?: boolean
  value?: string
  onValueChange?: (coin: string, quote: OutcomeSideQuote, index: OutcomeSideIndex) => void
}) {
  const [internalSideIndex, setInternalSideIndex] = useState<OutcomeSideIndex>(0)
  const controlledIndex = value ? event.sides.findIndex((quote) => quote.coin === value) : -1
  const sideIndex =
    controlledIndex === 0 || controlledIndex === 1 ? controlledIndex : internalSideIndex
  const selected = event.sides[sideIndex] ?? event.sides[0]
  const handleSideChange = (index: OutcomeSideIndex) => {
    setInternalSideIndex(index)
    const quote = event.sides[index]
    onValueChange?.(quote.coin, quote, index)
  }

  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[680px]">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Outcome side selector</div>
              <p className="mt-1 truncate text-sm text-neutral-500">{event.title}</p>
            </div>
            <span className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-500 dark:border-neutral-800">
              {disabled ? 'locked' : 'read only'}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {event.sides.map((quote, index) => (
              <button
                key={quote.coin}
                type="button"
                disabled={disabled}
                aria-pressed={index === sideIndex}
                aria-label={`Select ${quote.label} side, ${quote.coin}`}
                onClick={() => handleSideChange(index as OutcomeSideIndex)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  index === sideIndex
                    ? 'border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/55'
                    : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
                  disabled && 'cursor-not-allowed opacity-70',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{quote.label}</div>
                    <div className="mt-1 text-xs tabular-nums text-neutral-500">{quote.coin}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold tabular-nums">
                      {priceLabel(quote.bestAsk)}
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-neutral-500">
                      {probabilityLabel(quote.probability)}
                    </div>
                  </div>
                </div>
                <ProgressBar
                  value={quote.probability ?? 0}
                  tone={index === 0 ? 'green' : 'red'}
                  className="mt-4"
                />
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="grid gap-2 sm:grid-cols-3">
              <BookCell label="selected" value={selected.label} />
              <BookCell label="coin" value={selected.coin} />
              <BookCell label="ask" value={priceLabel(selected.bestAsk)} />
            </div>
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

export function OutcomeOrderBook({
  event,
  empty,
  sideIndex,
  onSideChange,
  levelsByCoin,
}: {
  event: OutcomeEventData
  empty?: boolean
  sideIndex?: OutcomeSideIndex
  onSideChange?: (quote: OutcomeSideQuote, index: OutcomeSideIndex) => void
  levelsByCoin?: Record<string, OutcomeOrderBookSideLevels | undefined>
}) {
  const [internalSideIndex, setInternalSideIndex] = useState<OutcomeSideIndex>(0)
  const activeSideIndex = sideIndex ?? internalSideIndex
  const side = event.sides[activeSideIndex] ?? event.sides[0]
  const suppliedLevels = levelsByCoin?.[side.coin]
  const bids = empty ? [] : (suppliedLevels?.bids ?? bookRows(side, 'bid'))
  const asks = empty ? [] : (suppliedLevels?.asks ?? bookRows(side, 'ask'))
  const handleSideChange = (index: OutcomeSideIndex) => {
    setInternalSideIndex(index)
    onSideChange?.(event.sides[index], index)
  }

  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[720px]">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="h-4 w-4 text-neutral-500" />
                Outcome order book
              </div>
              <div className="mt-1 truncate text-xs text-neutral-500">{event.title}</div>
            </div>
            <div className="flex rounded-md border border-neutral-200 p-1 dark:border-neutral-800">
              {event.sides.map((quote, index) => (
                <button
                  key={quote.coin}
                  type="button"
                  aria-pressed={index === activeSideIndex}
                  aria-label={`Show ${quote.label} side book`}
                  onClick={() => handleSideChange(index as OutcomeSideIndex)}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium transition-colors',
                    index === activeSideIndex
                      ? 'bg-neutral-100 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50'
                      : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50',
                  )}
                >
                  {quote.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <BookSide title="Bids" rows={bids} tone="green" />
            <BookSide title="Asks" rows={asks} tone="red" />
          </div>

          <div className="grid gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:grid-cols-3">
            <BookCell label="coin" value={side.coin} />
            <BookCell label="spread" value={spreadLabel(side)} />
            <BookCell label="depth" value={side.depth ?? '$0'} />
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

export function OutcomePositionRows({
  positions,
  compact,
}: {
  positions: OutcomePositionData[]
  compact?: boolean
}) {
  const rows = positions.slice(0, compact ? 2 : 4)

  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[760px]">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <WalletCards className="h-4 w-4 text-neutral-500" />
                Outcome positions
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Resolved side coins for portfolios.
              </div>
            </div>
            <div className="hidden items-center gap-1 text-xs text-neutral-500 sm:flex">
              <CheckCircle2 className="h-3.5 w-3.5" />
              no write action
            </div>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((position) => (
              <PositionRow key={`${position.market}-${position.coin}`} position={position} />
            ))}
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

export function OutcomeEmptyList() {
  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[760px]">
        <CardContent className="flex min-h-48 items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-md border border-neutral-200 dark:border-neutral-800">
              <ListChecks className="h-4 w-4 text-neutral-500" />
            </div>
            <div className="mt-3 text-sm font-semibold">No outcome markets</div>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Keep the list calm when filters, live reads, or search return no rows.
            </p>
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

export function OutcomeEmptyPositions() {
  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[680px]">
        <CardContent className="flex min-h-44 items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-md border border-neutral-200 dark:border-neutral-800">
              <WalletCards className="h-4 w-4 text-neutral-500" />
            </div>
            <div className="mt-3 text-sm font-semibold">No HIP-4 positions yet</div>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Show an empty portfolio state instead of raw account data or a blank table.
            </p>
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

function SideQuoteButton({
  quote,
  active,
  tone,
  onClick,
}: {
  quote: OutcomeSideQuote
  active: boolean
  tone: 'green' | 'red'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Select ${quote.label} side`}
      onClick={onClick}
      className={cn(
        'min-w-0 max-w-full overflow-hidden rounded-lg border p-3 text-left transition-colors',
        active
          ? 'border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/60'
          : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{quote.label}</div>
          <div className="mt-1 text-xs text-neutral-500">Best ask</div>
        </div>
        <div
          className={cn(
            'shrink-0 text-xl font-semibold tabular-nums',
            tone === 'green'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-red-700 dark:text-red-300',
          )}
        >
          {priceLabel(quote.bestAsk)}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span className="tabular-nums">{quote.coin}</span>
        <span className="tabular-nums">{probabilityLabel(quote.probability)}</span>
      </div>
    </button>
  )
}

function SmallQuote({ quote, tone }: { quote: OutcomeSideQuote; tone: 'green' | 'red' }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800 sm:block sm:text-right">
      <div className="text-xs text-neutral-500">{quote.label}</div>
      <div
        className={cn(
          'mt-0 text-sm font-semibold tabular-nums sm:mt-1',
          tone === 'green'
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-red-700 dark:text-red-300',
        )}
      >
        {priceLabel(quote.bestAsk)}
      </div>
    </div>
  )
}

function PositionRow({ position }: { position: OutcomePositionData }) {
  return (
    <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_108px_92px_76px] sm:items-center">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{position.market}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
          <span>{position.side} side</span>
          <span className="hidden sm:inline">-</span>
          <span className="tabular-nums">{position.coin}</span>
        </div>
      </div>
      <MiniCell label="position" value={position.position} />
      <MiniCell
        label="mark"
        value={position.mark}
        tone={position.state === 'settled' ? undefined : 'green'}
      />
      <MiniCell label="state" value={positionStateLabel(position.state)} />
    </div>
  )
}

function BookSide({
  title,
  rows,
  tone,
}: {
  title: string
  rows: OutcomeBookRow[]
  tone: 'green' | 'red'
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-neutral-500">
        <span>{title}</span>
        <span>Shares</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={`${title}-${row.price}-${row.size}`}
            className="relative overflow-hidden rounded bg-neutral-50 px-2 py-1.5 text-xs dark:bg-neutral-900"
          >
            <span
              className={cn(
                'absolute inset-y-0 right-0',
                tone === 'green'
                  ? 'bg-emerald-100 dark:bg-emerald-950/40'
                  : 'bg-red-100 dark:bg-red-950/40',
              )}
              style={{ width: `${row.depthPct}%` }}
            />
            <span className="relative flex items-center justify-between gap-2">
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  tone === 'green'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300',
                )}
              >
                {row.price}
              </span>
              <span className="tabular-nums text-neutral-500">{row.size}</span>
            </span>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-200 px-3 py-6 text-center text-sm text-neutral-500 dark:border-neutral-800">
          No levels
        </div>
      ) : null}
    </div>
  )
}

function BookCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </div>
      <div className="mt-1 truncate font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function MiniCell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'green'
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 truncate text-sm font-semibold',
          /\d/.test(value) && 'tabular-nums',
          tone === 'green' && 'text-emerald-700 dark:text-emerald-300',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function bookRows(read: OutcomeSideQuote, side: 'bid' | 'ask'): OutcomeBookRow[] {
  const base = Number(side === 'bid' ? read.bestBid : read.bestAsk)
  const fallback = side === 'bid' ? 0.68 : 0.72
  const anchor = Number.isFinite(base) ? base : fallback
  const direction = side === 'bid' ? -1 : 1

  return [0, 1, 2].map((index) => ({
    price: priceLabel(String(anchor + direction * index * 0.01)),
    size: formatShares((3 - index) * 1840 + (read.probability ?? 50) * 12),
    depthPct: 84 - index * 18,
  }))
}

function formatShares(value: number) {
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toFixed(0)
}

function positionStateLabel(state: OutcomePositionData['state']) {
  if (state === 'redeemable') return 'Redeem'
  if (state === 'settled') return 'Settled'
  if (state === 'held') return 'Held'
  return 'Watch'
}

function spreadLabel(read: OutcomeSideQuote) {
  const bid = Number(read.bestBid)
  const ask = Number(read.bestAsk)
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0) return '-'
  return `${Math.abs((ask - bid) * 100).toFixed(1)}c`
}

function priceLabel(value?: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return `${Math.round(parsed * 100)}c`
}

function probabilityLabel(value: number | null) {
  return value === null ? '-' : `${value}%`
}

function bookPriceLabel(read: OutcomeSideQuote) {
  return `${priceLabel(read.bestBid)} / ${priceLabel(read.bestAsk)}`
}
