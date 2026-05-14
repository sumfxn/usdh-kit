'use client'

import dynamic from 'next/dynamic'

import type { ComponentSlug, RegistryDataMode } from '../lib/component-registry'
import type { GallerySnapshot } from '../lib/gallery-data'
import { Panel } from './registry/preview-primitives'
import type { PreviewSize } from './registry/preview-primitives'

interface ComponentPreviewProps {
  slug: ComponentSlug
  snapshot: GallerySnapshot
  dataMode: RegistryDataMode
  size?: PreviewSize
  previewId?: string
}

type SnapshotPreviewProps = {
  snapshot: GallerySnapshot
  size: PreviewSize
  previewId?: string
}

type MarketPreviewProps = SnapshotPreviewProps & {
  dataMode: RegistryDataMode
}

type StaticPreviewProps = {
  size: PreviewSize
  previewId?: string
}

const UsdhWidgetPreview = dynamic<SnapshotPreviewProps>(
  () => import('./registry/previews/widget').then((module) => module.UsdhWidgetPreview),
  { loading: PreviewLoading },
)
const MarketBoardPreview = dynamic<MarketPreviewProps>(
  () => import('./registry/previews/market-board').then((module) => module.MarketBoardPreview),
  { loading: PreviewLoading },
)
const OutcomeKitPreview = dynamic<SnapshotPreviewProps>(
  () => import('./registry/previews/outcomes').then((module) => module.OutcomeKitPreview),
  { loading: PreviewLoading },
)
const OrderTicketPreview = dynamic<SnapshotPreviewProps>(
  () => import('./registry/previews/order-ticket').then((module) => module.OrderTicketPreview),
  { loading: PreviewLoading },
)
const FlowChartPreview = dynamic<StaticPreviewProps>(
  () => import('./registry/previews/flows').then((module) => module.FlowChartPreview),
  { loading: PreviewLoading },
)
const BridgeSwapRoutePreview = dynamic<StaticPreviewProps>(
  () => import('./registry/previews/flows').then((module) => module.BridgeSwapRoutePreview),
  { loading: PreviewLoading },
)
const SdkPrimitiveCardsPreview = dynamic<SnapshotPreviewProps>(
  () =>
    import('./registry/previews/sdk-primitives').then((module) => module.SdkPrimitiveCardsPreview),
  { loading: PreviewLoading },
)

export function ComponentPreview({
  slug,
  snapshot,
  dataMode,
  size = 'full',
  previewId,
}: ComponentPreviewProps) {
  switch (slug) {
    case 'usdh-widget':
      return <UsdhWidgetPreview snapshot={snapshot} size={size} previewId={previewId} />
    case 'market-board':
      return (
        <MarketBoardPreview
          snapshot={snapshot}
          dataMode={dataMode}
          size={size}
          previewId={previewId}
        />
      )
    case 'quote-readiness':
      return (
        <MarketBoardPreview
          snapshot={snapshot}
          dataMode={dataMode}
          size={size}
          previewId={previewId ?? 'readiness'}
        />
      )
    case 'outcome-reads':
      return <OutcomeKitPreview snapshot={snapshot} size={size} previewId={previewId} />
    case 'outcome-market-row':
      return (
        <OutcomeKitPreview snapshot={snapshot} size={size} previewId={previewId ?? 'market-row'} />
      )
    case 'outcome-odds-selector':
      return (
        <OutcomeKitPreview
          snapshot={snapshot}
          size={size}
          previewId={previewId ?? 'odds-selector'}
        />
      )
    case 'outcome-order-book':
      return (
        <OutcomeKitPreview snapshot={snapshot} size={size} previewId={previewId ?? 'order-book'} />
      )
    case 'outcome-position-row':
      return (
        <OutcomeKitPreview
          snapshot={snapshot}
          size={size}
          previewId={previewId ?? 'position-row'}
        />
      )
    case 'order-ticket-mock':
      return <OrderTicketPreview snapshot={snapshot} size={size} previewId={previewId} />
    case 'flow-chart':
      return <FlowChartPreview size={size} previewId={previewId} />
    case 'bridge-swap-route':
      return <BridgeSwapRoutePreview size={size} previewId={previewId} />
    case 'sdk-primitive-cards':
      return <SdkPrimitiveCardsPreview snapshot={snapshot} size={size} previewId={previewId} />
    default:
      return null
  }
}

function PreviewLoading() {
  return (
    <Panel className="h-56 animate-pulse bg-neutral-50 dark:bg-neutral-900/35">
      <span className="sr-only">Loading preview</span>
    </Panel>
  )
}
