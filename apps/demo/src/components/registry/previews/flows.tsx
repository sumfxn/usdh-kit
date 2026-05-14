'use client'

import { CheckCircle2, GitBranch, RefreshCw, Route } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import {
  MetricCard,
  MetricList,
  Panel,
  PreviewHeader,
  PreviewShell,
  type PreviewSize,
  ProgressBar,
  StatusPill,
} from '../preview-primitives'

const routeStates = [
  {
    phase: 'source',
    title: 'Source balance',
    body: 'Resolve spendable USDC on HyperEVM and HyperCore before route selection.',
    detail: 'wallet read',
    progress: 100,
    tone: 'green',
  },
  {
    phase: 'preflight',
    title: 'Quote preflight',
    body: 'Check USDH depth, minimum order value, slippage, and route dependency.',
    detail: 'read gate',
    progress: 76,
    tone: 'green',
  },
  {
    phase: 'credit',
    title: 'Bridge credit',
    body: 'Wait for HyperCore credit before the spot order can be staged.',
    detail: 'watcher',
    progress: 44,
    tone: 'amber',
  },
  {
    phase: 'fill',
    title: 'USDH fill',
    body: 'Enable the fill only after balance and book checks pass.',
    detail: 'ready',
    progress: 0,
    tone: 'neutral',
  },
] as const

const routeEvents = [
  {
    phase: 'quote',
    label: 'Quote locked',
    body: 'USDH pair, slippage, and source chain are fixed for review.',
    eta: '<1s',
    status: 'complete',
  },
  {
    phase: 'bridge',
    label: 'Bridge credit watcher',
    body: 'UI waits for HyperCore credit instead of pretending the bridge is instant.',
    eta: '1-2m',
    status: 'active',
  },
  {
    phase: 'swap',
    label: 'Spot gate',
    body: 'Spot fill stays gated until book, minimum notional, and balance checks pass.',
    eta: '2-4s',
    status: 'pending',
  },
  {
    phase: 'settle',
    label: 'Balance refresh',
    body: 'Receipt and balances refresh after the route completes.',
    eta: 'done',
    status: 'pending',
  },
] as const

export function FlowChartPreview({
  size,
  previewId,
}: {
  size: PreviewSize
  previewId?: string
}) {
  if (previewId === 'bridge-credit-watcher') return <BridgeCreditWatcher />
  if (previewId === 'failure-state') return <FailureState />
  if (previewId === 'compact-route-state') return <CompactRouteState />

  return (
    <PreviewShell>
      <PreviewHeader icon={Route} title="Route state card" eyebrow="Reusable app state" />
      <RouteStateLayout size={size} />
    </PreviewShell>
  )
}

export function BridgeSwapRoutePreview({
  size,
  previewId,
}: {
  size: PreviewSize
  previewId?: string
}) {
  if (previewId === 'route-receipt') return <RouteReceipt />
  if (previewId === 'failure-waiting-state') return <FailureState />
  if (previewId === 'compact-route-state') return <CompactRouteState />

  return (
    <PreviewShell>
      <PreviewHeader icon={GitBranch} title="Bridge/swap receipt" eyebrow="Route lifecycle" />
      <div
        className={cn(
          'grid gap-4',
          size === 'full' && 'items-start lg:grid-cols-[320px_minmax(0,1fr)]',
        )}
      >
        <RouteSummary />
        <RouteReceipt />
      </div>
    </PreviewShell>
  )
}

function RouteStateLayout({ size }: { size: PreviewSize }) {
  const [activeIndex, setActiveIndex] = useState(1)
  const active = routeStates[activeIndex] ?? routeStates[0]

  return (
    <Panel>
      <CardContent
        className={cn('grid gap-4 p-4', size === 'full' && 'lg:grid-cols-[280px_minmax(0,1fr)]')}
      >
        <div className="space-y-2">
          {routeStates.map((step, index) => (
            <RouteStateButton
              key={step.phase}
              step={step}
              index={index}
              selected={index === activeIndex}
              complete={index < activeIndex}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <CompactRouteState activeIndex={activeIndex} />
          <Separator className="my-4" />
          <div className="text-sm font-medium">{active.title}</div>
          <p className="mt-2 text-sm leading-6 text-neutral-500">{active.body}</p>
          <Separator className="my-4" />
          <MetricList
            rows={[
              ['Read coverage', activeIndex >= 1 ? 'complete' : 'pending', 'green'],
              ['Bridge dependency', activeIndex >= 2 ? 'observed' : 'not needed yet', 'amber'],
              ['User action', activeIndex < 3 ? 'review' : 'confirm'],
            ]}
          />
        </div>
      </CardContent>
    </Panel>
  )
}

function RouteSummary() {
  return (
    <Panel>
      <CardContent className="space-y-4 p-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            Route receipt
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <RouteEndpoint asset="USDC" chain="HyperEVM" />
            <GitBranch className="h-4 w-4 text-neutral-500" />
            <RouteEndpoint asset="USDH" chain="HyperCore" align="right" />
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <MetricList
            rows={[
              ['Amount', '250 USDC'],
              ['Mode', 'read-gated'],
              ['Writes', 'blocked in registry'],
            ]}
          />
        </div>
      </CardContent>
    </Panel>
  )
}

function RouteReceipt() {
  const [activeIndex, setActiveIndex] = useState(1)
  const active = routeEvents[activeIndex] ?? routeEvents[0]
  return (
    <Panel>
      <CardContent className="space-y-3 p-4">
        {routeEvents.map((event, index) => (
          <button
            key={event.phase}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={cn(
              'grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors',
              index === activeIndex
                ? 'border-neutral-400 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/70'
                : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
            )}
          >
            <RouteMarker
              complete={index < activeIndex}
              selected={index === activeIndex}
              index={index}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{event.label}</span>
              <span className="block truncate text-xs text-neutral-500">{event.body}</span>
            </span>
            <span className="text-xs tabular-nums text-neutral-500">{event.eta}</span>
          </button>
        ))}
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            {active.phase}
          </div>
          <div className="mt-1 text-sm font-medium">{active.label}</div>
          <p className="mt-2 text-sm leading-6 text-neutral-500">{active.body}</p>
        </div>
      </CardContent>
    </Panel>
  )
}

function CompactRouteState({ activeIndex = 1 }: { activeIndex?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {routeStates.map((state, index) => (
        <div
          key={state.phase}
          className={cn(
            'rounded-md border p-3 transition-colors',
            index <= activeIndex
              ? 'border-neutral-400 bg-white dark:border-neutral-700 dark:bg-neutral-950'
              : 'border-neutral-200 text-neutral-500 dark:border-neutral-800',
          )}
        >
          <div className="text-sm font-semibold">{state.title}</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            {state.detail}
          </div>
          <ProgressBar
            value={index < activeIndex ? 100 : index === activeIndex ? state.progress : 0}
            tone={state.tone === 'neutral' ? 'amber' : state.tone}
            className="mt-3 h-1"
          />
        </div>
      ))}
    </div>
  )
}

function BridgeCreditWatcher() {
  return (
    <Panel>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Credit watcher
            </div>
            <div className="mt-1 text-base font-semibold">Waiting for HyperCore credit</div>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              The UI stays honest while the bridge settles, then unlocks the spot gate.
            </p>
          </div>
          <StatusPill tone="amber">waiting</StatusPill>
        </div>
        <ProgressBar value={44} tone="amber" className="h-2" />
        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="elapsed" value="38s" />
          <MetricCard label="eta" value="1-2m" />
          <MetricCard label="writes" value="none" />
        </div>
      </CardContent>
    </Panel>
  )
}

function FailureState() {
  return (
    <Panel>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Waiting state
            </div>
            <div className="mt-1 text-base font-semibold">Bridge credit not observed yet</div>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Keep the user in a recoverable receipt instead of dropping them back into a blank
              form.
            </p>
          </div>
          <StatusPill tone="amber">recoverable</StatusPill>
        </div>
        <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <MetricList
            rows={[
              ['Last read', '12s ago'],
              ['Next check', '8s'],
              ['Action', 'keep watching'],
            ]}
          />
        </div>
        <Button variant="outline" className="w-full">
          <RefreshCw className="h-4 w-4" />
          Check credit again
        </Button>
      </CardContent>
    </Panel>
  )
}

function RouteStateButton({
  step,
  index,
  selected,
  complete,
  onClick,
}: {
  step: (typeof routeStates)[number]
  index: number
  selected: boolean
  complete: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid w-full grid-cols-[28px_1fr] gap-3 rounded-md border px-3 py-3 text-left transition-colors',
        selected
          ? 'border-neutral-400 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/70'
          : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
      )}
    >
      <RouteMarker complete={complete} selected={selected} index={index} />
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-3">
          <span className="font-medium">{step.title}</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            {step.detail}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-5 text-neutral-500">{step.body}</span>
      </span>
    </button>
  )
}

function RouteMarker({
  complete,
  selected,
  index,
}: {
  complete: boolean
  selected: boolean
  index: number
}) {
  return (
    <span
      className={cn(
        'grid h-7 w-7 place-items-center rounded-full border text-xs tabular-nums',
        complete
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
          : selected
            ? 'border-neutral-400 bg-neutral-900 text-white dark:border-neutral-700 dark:bg-neutral-100 dark:text-neutral-950'
            : 'border-neutral-200 text-neutral-500 dark:border-neutral-800',
      )}
    >
      {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
    </span>
  )
}

function RouteEndpoint({
  asset,
  chain,
  align,
}: {
  asset: string
  chain: string
  align?: 'right'
}) {
  return (
    <div className={cn('min-w-0', align === 'right' && 'text-right')}>
      <div className="text-sm font-semibold">{asset}</div>
      <div className="mt-1 truncate text-xs text-neutral-500">{chain}</div>
    </div>
  )
}
