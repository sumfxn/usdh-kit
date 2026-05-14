'use client'

import { BookOpen, Boxes, Coins, Database, Route } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import type { GallerySnapshot } from '../../../lib/gallery-data'
import {
  Panel,
  PreviewHeader,
  PreviewShell,
  type PreviewSize,
  StatusPill,
} from '../preview-primitives'

export function SdkPrimitiveCardsPreview({
  snapshot,
  size,
}: {
  snapshot: GallerySnapshot
  size: PreviewSize
  previewId?: string
}) {
  const [activeKey, setActiveKey] = useState('pairs')
  const primitives = useMemo(
    () => [
      {
        key: 'pairs',
        title: 'listUsdhSpotPairs',
        icon: Database,
        detail: 'Discover USDH base/quote markets from spot metadata.',
        value: `${snapshot.pairs.length || 3} pairs`,
        code: 'const pairs = listUsdhSpotPairs(spotMeta)',
      },
      {
        key: 'books',
        title: 'l2Book',
        icon: BookOpen,
        detail: 'Read top-of-book depth for selected HIP-4 coins.',
        value: `${snapshot.book.bids.length + snapshot.book.asks.length} levels`,
        code: 'const book = await info.l2Book(pair.name)',
      },
      {
        key: 'outcomes',
        title: 'normalizeOutcomeMeta',
        icon: Coins,
        detail: 'Normalize outcome market ids and side coins.',
        value: `${snapshot.outcomes.length || 2} markets`,
        code: 'const markets = normalizeOutcomeMeta(meta)',
      },
      {
        key: 'routes',
        title: 'preflightSwap',
        icon: Route,
        detail: 'Price route readiness before any write path.',
        value: snapshot.mode === 'live' ? 'read-only' : 'offline',
        code: 'const route = await kit.preflightSwap(input)',
      },
    ],
    [snapshot],
  )
  const active = primitives.find((primitive) => primitive.key === activeKey) ?? primitives[0]

  return (
    <PreviewShell>
      <PreviewHeader icon={Boxes} title="SDK primitives" eyebrow="Builder API map" />
      <div
        className={cn(
          'grid gap-4',
          size === 'full' && 'items-start lg:grid-cols-[minmax(0,1fr)_300px]',
        )}
      >
        <div className={cn('grid gap-3', size === 'full' && 'sm:grid-cols-2')}>
          {primitives.map((primitive) => (
            <button
              key={primitive.key}
              type="button"
              onClick={() => setActiveKey(primitive.key)}
              className={cn(
                'rounded-md border bg-white p-4 text-left transition-colors dark:bg-neutral-950',
                primitive.key === active?.key
                  ? 'border-neutral-400 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/70'
                  : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                  <primitive.icon className="h-3.5 w-3.5 text-neutral-500" />
                </span>
                <span className="text-xs tabular-nums text-neutral-500">{primitive.value}</span>
              </div>
              <div className="mt-4 text-sm font-semibold">{primitive.title}</div>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{primitive.detail}</p>
            </button>
          ))}
        </div>

        <Panel>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-neutral-500">primitive</div>
                <div className="mt-1 text-sm font-medium">{active?.title}</div>
                <p className="mt-2 text-sm leading-6 text-neutral-500">{active?.detail}</p>
              </div>
              <StatusPill>{active?.value}</StatusPill>
            </div>
            <Separator />
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
              {active?.code}
            </div>
          </CardContent>
        </Panel>
      </div>
    </PreviewShell>
  )
}
