'use client'

import { createSpotOrderDraft } from '@usdh-kit/sdk'
import { CheckCircle2 } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

import type { GallerySnapshot } from '../../../lib/gallery-data'
import {
  MetricCard,
  Panel,
  PreviewShell,
  type PreviewSize,
  fallbackPair,
} from '../preview-primitives'

type TicketState = 'draft' | 'review' | 'submitted'

export function OrderTicketPreview({
  snapshot,
  previewId,
}: {
  snapshot: GallerySnapshot
  size: PreviewSize
  previewId?: string
}) {
  const pair = snapshot.pairs[0] ?? fallbackPair
  const initialState: TicketState =
    previewId === 'submitted' ? 'submitted' : previewId === 'review' ? 'review' : 'draft'
  const [state, setState] = useState<TicketState>(initialState)
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [size, setSize] = useState('25')
  const [price, setPrice] = useState(pair.mid === '-' ? '1.0001' : pair.mid)
  const notional = Number(size) * Number(price)
  const draft = createSpotOrderDraft({
    pair: pair.label,
    side,
    size,
    price,
    sizeDecimals: 2,
    priceDecimals: 6,
    minNotional: 10,
    availableBase: '100',
    availableQuote: '100',
  })

  return (
    <PreviewShell>
      <Panel className="mx-auto w-full max-w-[720px]">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Order ticket</div>
                <div className="mt-1 text-xs tabular-nums text-neutral-500">{pair.label}</div>
              </div>
              <span
                className={cn(
                  'rounded-md border px-2 py-1 text-xs font-medium',
                  state === 'submitted'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-neutral-200 text-neutral-500 dark:border-neutral-800',
                )}
              >
                {stateLabel(state)}
              </span>
            </div>

            <ToggleGroup
              type="single"
              value={side}
              onValueChange={(value) => {
                if (value) setSide(value as 'buy' | 'sell')
              }}
              className="w-full"
              aria-label="Choose order side"
            >
              <ToggleGroupItem value="buy" className="flex-1 data-[state=on]:text-emerald-700">
                Buy
              </ToggleGroupItem>
              <ToggleGroupItem value="sell" className="flex-1 data-[state=on]:text-red-700">
                Sell
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="grid gap-3 sm:grid-cols-2">
              <TicketField label="Size" value={size} onChange={setSize} suffix="USDH" />
              <TicketField label="Limit price" value={price} onChange={setPrice} suffix="USDC" />
            </div>

            <Button
              className="w-full"
              variant={state === 'submitted' ? 'outline' : 'secondary'}
              disabled={state === 'draft' && !draft.canReview}
              onClick={() =>
                setState(state === 'draft' ? 'review' : state === 'review' ? 'submitted' : 'draft')
              }
            >
              {state === 'draft'
                ? 'Review order'
                : state === 'review'
                  ? 'Show submitted state'
                  : 'Reset draft'}
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="text-sm font-medium">Order summary</div>
            <MetricCard label="side" value={side} tone={side === 'buy' ? 'green' : 'red'} />
            <MetricCard
              label="notional"
              value={Number.isFinite(notional) ? `$${notional.toFixed(2)}` : '-'}
            />
            <MetricCard
              label="review"
              value={draft.canReview ? 'ready' : (draft.blockReason ?? 'blocked')}
            />
            <MetricCard label="submit" value="gated" />
            {state === 'submitted' ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Preview state
              </div>
            ) : null}
          </div>
        </CardContent>
      </Panel>
    </PreviewShell>
  )
}

function stateLabel(state: TicketState) {
  if (state === 'draft') return 'Draft'
  if (state === 'review') return 'Review'
  return 'Submitted'
}

function TicketField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  suffix: string
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className="mt-1 flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 dark:border-neutral-800 dark:bg-neutral-950">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          className="h-10 border-0 px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <span className="text-xs font-medium text-neutral-500">{suffix}</span>
      </span>
    </label>
  )
}
