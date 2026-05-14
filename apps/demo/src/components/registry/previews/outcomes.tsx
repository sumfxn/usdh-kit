'use client'

import { useState } from 'react'

import type { GalleryOutcome, GallerySnapshot } from '../../../lib/gallery-data'
import {
  galleryOutcomeToEventData,
  galleryOutcomeToLevelsByCoin,
  galleryOutcomesToPositionData,
  outcomeEventWithoutLiquidity,
} from '../patterns/outcome-adapters'
import {
  OutcomeEmptyList,
  OutcomeEmptyPositions,
  OutcomeEventCard,
  OutcomeLoadingCard,
  OutcomeMarketRows,
  OutcomeOddsSelector,
  OutcomeOrderBook,
  OutcomePositionRows,
} from '../patterns/outcomes'
import { type PreviewSize, fallbackOutcome } from '../preview-primitives'

export function OutcomeKitPreview({
  snapshot,
  size,
  previewId,
}: {
  snapshot: GallerySnapshot
  size: PreviewSize
  previewId?: string
}) {
  const outcomes = snapshot.outcomes.length > 0 ? snapshot.outcomes : [fallbackOutcome]
  const [selectedId, setSelectedId] = useState(outcomes[0]?.id ?? fallbackOutcome.id)
  const selected =
    outcomes.find((outcome) => outcome.id === selectedId) ?? outcomes[0] ?? fallbackOutcome
  const selectedEvent = galleryOutcomeToEventData(selected)

  if (previewId === 'loading') {
    return <OutcomeLoadingCard />
  }

  if (previewId === 'illiquid') {
    return <OutcomeEventCard event={outcomeEventWithoutLiquidity(selectedEvent)} showBookContext />
  }

  if (previewId === 'market-row') {
    return (
      <OutcomeMarketRows
        events={outcomes.map(galleryOutcomeToEventData)}
        selectedId={selected.id}
        onSelect={(id) => setSelectedId(Number(id))}
      />
    )
  }

  if (previewId === 'long-title') {
    const longOutcome = withLongTitle(selected)
    return (
      <OutcomeMarketRows
        events={[
          galleryOutcomeToEventData(longOutcome),
          ...outcomes
            .filter((outcome) => outcome.id !== selected.id)
            .map((outcome) => galleryOutcomeToEventData(outcome)),
        ]}
        selectedId={longOutcome.id}
        onSelect={(id) => setSelectedId(Number(id))}
      />
    )
  }

  if (previewId === 'empty') {
    return <OutcomeEmptyList />
  }

  if (previewId === 'odds-selector') {
    return <OutcomeOddsSelector event={selectedEvent} />
  }

  if (previewId === 'disabled') {
    return <OutcomeOddsSelector event={selectedEvent} disabled />
  }

  if (previewId === 'order-book') {
    return (
      <OutcomeOrderBook
        event={selectedEvent}
        levelsByCoin={galleryOutcomeToLevelsByCoin(selected, 0)}
      />
    )
  }

  if (previewId === 'empty-book') {
    return <OutcomeOrderBook event={outcomeEventWithoutLiquidity(selectedEvent)} empty />
  }

  if (previewId === 'position-row' || previewId === 'portfolio' || previewId === 'watchlist') {
    return (
      <OutcomePositionRows
        positions={galleryOutcomesToPositionData(outcomes)}
        compact={previewId === 'watchlist'}
      />
    )
  }

  if (previewId === 'redeemable') {
    return (
      <OutcomePositionRows
        positions={galleryOutcomesToPositionData(outcomes, { state: 'redeemable' })}
      />
    )
  }

  if (previewId === 'empty-positions') {
    return <OutcomeEmptyPositions />
  }

  return (
    <OutcomeEventCard
      event={selectedEvent}
      compact={size === 'compact' || previewId === 'compact'}
      showBookContext={previewId === 'with-book'}
    />
  )
}

function withLongTitle(outcome: GalleryOutcome): GalleryOutcome {
  return {
    ...outcome,
    name: 'USDH weekly volume clears $5m before Friday settlement window',
  }
}
