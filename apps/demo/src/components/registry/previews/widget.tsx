'use client'

import { type L2Book, createQuoteSummaryData } from '@usdh-kit/sdk'
import { USDHSwap } from '@usdh-kit/widget'
import { CheckCircle2, LockKeyhole, WalletCards } from 'lucide-react'

import { CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { GallerySnapshot } from '../../../lib/gallery-data'
import {
  MetricRow,
  Panel,
  PreviewShell,
  type PreviewSize,
  fallbackPair,
} from '../preview-primitives'

const DEMO_AMOUNT = '250'

export function UsdhWidgetPreview({
  snapshot,
  size,
  previewId,
}: {
  snapshot: GallerySnapshot
  size: PreviewSize
  previewId?: string
}) {
  if (previewId === 'pre-wallet-context') {
    return <PreWalletContext snapshot={snapshot} compact />
  }

  return (
    <PreviewShell>
      <div
        className={cn(
          'grid gap-4',
          size === 'full' && 'items-center lg:grid-cols-[minmax(0,1fr)_320px]',
        )}
      >
        <Panel className="bg-neutral-50 dark:bg-neutral-950">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <WalletCards className="h-4 w-4 text-neutral-500" />
                  Swap module
                </div>
                <p className="mt-1 text-sm text-neutral-500">
                  Packaged USDHSwap with read-only quote before connect.
                </p>
              </div>
              <span className="hidden rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-500 dark:border-neutral-800 sm:inline-flex">
                no wallet writes
              </span>
            </div>
            <div className="flex min-w-0 justify-center">
              <div
                className="min-w-0 w-full justify-self-center"
                style={{
                  width:
                    size === 'compact'
                      ? 'min(100%, 420px, calc(100vw - 6rem))'
                      : 'min(100%, 480px, calc(100vw - 6rem))',
                  maxWidth:
                    size === 'compact'
                      ? 'min(420px, calc(100vw - 6rem))'
                      : 'min(480px, calc(100vw - 6rem))',
                }}
              >
                <USDHSwap network="mainnet" defaultAmount={DEMO_AMOUNT} theme="dark" />
              </div>
            </div>
          </CardContent>
        </Panel>
        <PreWalletContext snapshot={snapshot} />
      </div>
    </PreviewShell>
  )
}

function PreWalletContext({
  snapshot,
  compact,
}: {
  snapshot: GallerySnapshot
  compact?: boolean
}) {
  const pair =
    snapshot.pairs.find((item) => item.label === 'USDH/USDC') ?? snapshot.pairs[0] ?? fallbackPair
  const bestBid = snapshot.book.bids[0]?.price ?? '0.9999'
  const bestAsk = snapshot.book.asks[0]?.price ?? '1.0001'
  const summary = createQuoteSummaryData({
    pair: toQuotePair(pair),
    book: toL2Book(snapshot, bestBid, bestAsk),
    amount: DEMO_AMOUNT,
    payAsset: 'USDC',
    maxSpreadBps: 10,
    minSideDepth: 1_000,
  })

  return (
    <Panel>
      <CardContent className={cn('space-y-4 p-4', compact && 'sm:p-5')}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Quote context
            </div>
            <h3 className="mt-1 text-base font-semibold">Before wallet connect</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Show the expected receive amount and market health while the widget keeps submission
              gated.
            </p>
          </div>
          <LockKeyhole className="h-4 w-4 shrink-0 text-neutral-500" />
        </div>

        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-3">
            <QuoteStat label="pay" value={`${summary.pay.amount} ${summary.pay.asset}`} />
            <QuoteStat
              label="receive"
              value={`${summary.receive?.amount ?? '-'} ${summary.receive?.asset ?? 'USDH'}`}
              accent
            />
          </div>
        </div>

        <div className="space-y-2">
          <MetricRow label="Pair" value={summary.pair} />
          <MetricRow label="Best ask" value={summary.price ?? bestAsk} />
          <MetricRow
            label="Spread"
            value={
              summary.readiness.spreadBps === undefined
                ? '-'
                : `${summary.readiness.spreadBps.toFixed(1)} bps`
            }
          />
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/35">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Ready to quote
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Connect flow, approvals, and swap writes stay inside the widget.
          </p>
        </div>
      </CardContent>
    </Panel>
  )
}

function QuoteStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums',
          accent && 'text-emerald-700 dark:text-emerald-300',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function toQuotePair(pair: typeof fallbackPair) {
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
