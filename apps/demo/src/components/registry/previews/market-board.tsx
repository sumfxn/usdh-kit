'use client'

import { type L2Book, createQuoteReadiness, createQuoteSummaryData } from '@usdh-kit/sdk'
import { AlertCircle, CheckCircle2, ChevronDown, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { RegistryDataMode } from '../../../lib/component-registry'
import type { GalleryPair, GallerySnapshot } from '../../../lib/gallery-data'
import {
  DepthRows,
  MetricCard,
  Panel,
  PreviewShell,
  type PreviewSize,
  fallbackPair,
  liquidityScore,
} from '../preview-primitives'

export function MarketBoardPreview({
  snapshot,
  previewId,
}: {
  snapshot: GallerySnapshot
  dataMode: RegistryDataMode
  size: PreviewSize
  previewId?: string
}) {
  const pairs = snapshot.pairs.length > 0 ? snapshot.pairs : [fallbackPair]
  const liveBookPair = pairs.find((pair) => pair.name === snapshot.book.coin)
  const [selectedName, setSelectedName] = useState(
    liveBookPair?.name ?? pairs[0]?.name ?? fallbackPair.name,
  )

  useEffect(() => {
    if (snapshot.mode === 'live' && liveBookPair) setSelectedName(liveBookPair.name)
  }, [liveBookPair, snapshot.mode])

  const selected = pairs.find((pair) => pair.name === selectedName) ?? pairs[0] ?? fallbackPair
  const bestBid = snapshot.book.bids[0]?.price ?? '0.9999'
  const bestAsk = snapshot.book.asks[0]?.price ?? '1.0001'

  function selectPair(pair: GalleryPair) {
    setSelectedName(pair.name)
  }

  if (previewId?.startsWith('readiness')) {
    return (
      <QuoteReadiness
        pair={selected}
        snapshot={snapshot}
        bestBid={bestBid}
        bestAsk={bestAsk}
        compact={previewId === 'readiness-compact'}
        blocked={previewId === 'readiness-blocked'}
      />
    )
  }

  if (previewId === 'pair-select') {
    return <PairSelect pairs={pairs} selected={selected} onSelect={selectPair} />
  }

  if (previewId === 'depth') {
    return <DepthDetail snapshot={snapshot} pair={selected} bestBid={bestBid} bestAsk={bestAsk} />
  }

  return (
    <QuoteSummary
      pair={selected}
      snapshot={snapshot}
      bestBid={bestBid}
      bestAsk={bestAsk}
      inline={previewId === 'inline'}
    />
  )
}

function QuoteSummary({
  pair,
  snapshot,
  bestBid,
  bestAsk,
  inline,
}: {
  pair: GalleryPair
  snapshot: GallerySnapshot
  bestBid: string
  bestAsk: string
  inline?: boolean
}) {
  const summary = createQuoteSummaryData({
    pair: toQuotePair(pair),
    book: toL2Book(snapshot, bestBid, bestAsk),
    amount: '250',
    payAsset: 'USDC',
    maxSpreadBps: 10,
    minSideDepth: 1_000,
  })

  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[680px]">
        <CardContent className={cn('space-y-5 p-4', !inline && 'sm:p-5')}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Quote summary</div>
              <p className="mt-1 text-sm text-neutral-500">
                Read-only context for a USDH to USDC migration quote.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready for quote
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                You pay
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {summary.pay.amount} {summary.pay.asset}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                You receive
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {summary.receive?.amount ?? '-'} {summary.receive?.asset ?? 'USDH'}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <MetricCard label="pair" value={summary.pair} />
            <MetricCard
              label="spread"
              value={
                summary.readiness.spreadBps === undefined
                  ? '-'
                  : `${summary.readiness.spreadBps.toFixed(1)} bps`
              }
            />
            <MetricCard label="depth" value={summary.readiness.depth.ask} />
          </div>

          {!inline ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <MetricCard label="best bid" value={bestBid} tone="green" />
              <MetricCard label="best ask" value={bestAsk} tone="red" />
            </div>
          ) : null}
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

function QuoteReadiness({
  pair,
  snapshot,
  bestBid,
  bestAsk,
  compact,
  blocked,
}: {
  pair: GalleryPair
  snapshot: GallerySnapshot
  bestBid: string
  bestAsk: string
  compact?: boolean
  blocked?: boolean
}) {
  const readiness = createQuoteReadiness({
    pair: toQuotePair(pair),
    book: blocked ? toBlockedL2Book(snapshot, bestBid) : toL2Book(snapshot, bestBid, bestAsk),
    maxSpreadBps: 10,
    minSideDepth: 1_000,
  })
  const checks = [
    ...readiness.checks.map((check) => ({
      label: check.label,
      value: check.value,
      state: check.ready ? 'ready' : 'blocked',
    })),
  ]

  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[640px]">
        <CardContent className={cn('space-y-4 p-4', !compact && 'sm:p-5')}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-neutral-500" />
                Quote readiness
              </div>
              <p className="mt-1 max-w-[26rem] text-sm leading-6 text-neutral-500">
                Read-only guard before enabling quote or ticket handoff.
              </p>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium',
                blocked
                  ? 'border-red-900/40 bg-red-950/20 text-red-300'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300',
              )}
            >
              {blocked ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {readiness.ready ? 'Ready' : 'Blocked'}
            </span>
          </div>

          <div className={cn('grid gap-2', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-4')}>
            {checks.map((check) => (
              <div
                key={check.label}
                className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                    {check.label}
                  </div>
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      check.state === 'ready' ? 'bg-emerald-400' : 'bg-red-400',
                    )}
                  />
                </div>
                <div className="mt-2 truncate text-sm font-semibold tabular-nums">
                  {check.value}
                </div>
              </div>
            ))}
          </div>

          {!compact ? (
            <div className="rounded-lg border border-neutral-200 p-3 text-sm leading-6 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              Parent owns the disabled button, stale cache policy, wallet state, and final write
              path.
            </div>
          ) : null}
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

function PairSelect({
  pairs,
  selected,
  onSelect,
}: {
  pairs: GalleryPair[]
  selected: GalleryPair
  onSelect: (pair: GalleryPair) => void
}) {
  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[560px]">
        <CardContent className="space-y-3 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2.5 text-left dark:border-neutral-800"
          >
            <span>
              <span className="block text-sm font-medium">{selected.label}</span>
              <span className="mt-1 block text-xs tabular-nums text-neutral-500">
                {selected.name} index {selected.index}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-neutral-500" />
          </button>
          <div className="space-y-1">
            {pairs.slice(0, 4).map((pair) => (
              <button
                key={pair.name}
                type="button"
                onClick={() => onSelect(pair)}
                className={cn(
                  'grid w-full grid-cols-[minmax(0,1fr)_72px] gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                  pair.name === selected.name
                    ? 'bg-neutral-100 dark:bg-neutral-900'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{pair.label}</span>
                  <span className="mt-1 block text-xs text-neutral-500">
                    {pair.role === 'base' ? 'USDH base' : 'USDH quote'}
                  </span>
                </span>
                <span className="self-center text-right text-sm tabular-nums">{pair.mid}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

function DepthDetail({
  snapshot,
  pair,
  bestBid,
  bestAsk,
}: {
  snapshot: GallerySnapshot
  pair: GalleryPair
  bestBid: string
  bestAsk: string
}) {
  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[720px]">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">{pair.label}</div>
              <div className="mt-1 text-xs tabular-nums text-neutral-500">{pair.name}</div>
            </div>
            <MetricCard label="score" value={`${liquidityScore(pair, 0)}%`} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <DepthRows title="Bid" value={bestBid} levels={snapshot.book.bids} tone="green" />
            <DepthRows title="Ask" value={bestAsk} levels={snapshot.book.asks} tone="red" />
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

function toQuotePair(pair: GalleryPair) {
  const [base, quote] = pair.label.split('/')
  return {
    name: pair.name,
    label: pair.label,
    base: base ?? 'USDH',
    quote: quote ?? 'USDC',
  }
}

function toL2Book(snapshot: GallerySnapshot, bestBid: string, bestAsk: string): L2Book {
  return {
    coin: snapshot.book.coin,
    time: Date.parse(snapshot.generatedAt),
    levels: [
      snapshot.book.bids.map((level, index) => ({
        px: index === 0 ? bestBid : level.price,
        sz: level.size,
        n: level.orders,
      })),
      snapshot.book.asks.map((level, index) => ({
        px: index === 0 ? bestAsk : level.price,
        sz: level.size,
        n: level.orders,
      })),
    ],
  }
}

function toBlockedL2Book(snapshot: GallerySnapshot, bestBid: string): L2Book {
  return {
    ...toL2Book(snapshot, bestBid, '1.0001'),
    levels: [
      snapshot.book.bids.map((level, index) => ({
        px: index === 0 ? bestBid : level.price,
        sz: level.size,
        n: level.orders,
      })),
      [],
    ],
  }
}
