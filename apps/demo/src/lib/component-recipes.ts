import type { ComponentSlug } from './component-registry'

export interface ComponentRecipe {
  title: string
  description: string
  steps: string[]
  relatedSlug?: ComponentSlug
  relatedLabel?: string
}

export function getComponentRecipes(slug: ComponentSlug): ComponentRecipe[] {
  switch (slug) {
    case 'usdh-widget':
      return [
        {
          title: 'Drop in the swap entry',
          description: 'Use the packaged widget as the only write boundary.',
          steps: [
            'Mount USDHSwap inside your wallet route.',
            'Keep quote context around it read-only.',
            'Handle completion and analytics in the parent app.',
          ],
          relatedSlug: 'market-board',
          relatedLabel: 'Add quote context',
        },
      ]
    case 'market-board':
      return [
        {
          title: 'Pre-wallet quote check',
          description: 'Show whether the swap form has enough market depth.',
          steps: [
            'Discover USDH pairs from spot metadata.',
            'Read the selected l2Book.',
            'Render receive estimate, spread, depth, and readiness.',
          ],
          relatedSlug: 'usdh-widget',
          relatedLabel: 'Pair with widget',
        },
      ]
    case 'quote-readiness':
      return [
        {
          title: 'Gate quote intent',
          description: 'Use readiness checks before enabling a quote or ticket handoff.',
          steps: [
            'Read the selected pair and l2Book.',
            'Derive spread, top-of-book depth, and stale state.',
            'Let the parent disable quote actions when any check blocks.',
          ],
          relatedSlug: 'market-board',
          relatedLabel: 'Show quote summary',
        },
      ]
    case 'outcome-market-row':
      return [
        {
          title: 'Build a market feed',
          description: 'Use rows as the scan surface before a market detail page.',
          steps: [
            'Normalize outcomeMeta into event data.',
            'Attach side prices when books are available.',
            'Route the selected row into an event detail page.',
          ],
          relatedSlug: 'outcome-reads',
          relatedLabel: 'Open event card',
        },
        {
          title: 'Support search results',
          description: 'Keep list behavior in the parent, not inside the row.',
          steps: [
            'Own query, filters, sorting, and pagination above the row.',
            'Pass selectedId for master/detail layouts.',
            'Render empty state when no market matches.',
          ],
        },
      ]
    case 'outcome-reads':
      return [
        {
          title: 'Build a market detail header',
          description: 'Turn one HIP-4 market into a user-facing event card.',
          steps: [
            'Read outcomeMeta and resolve both side coins.',
            'Fetch top-of-book only as optional context.',
            'Keep trade intent outside the card.',
          ],
          relatedSlug: 'outcome-odds-selector',
          relatedLabel: 'Add side selector',
        },
        {
          title: 'Render a feed card',
          description: 'Use the compact variant when a page shows many markets.',
          steps: [
            'Use compact spacing for feeds and watchlists.',
            'Show loading and illiquid states without fake odds.',
            'Link the card to a market detail route.',
          ],
        },
      ]
    case 'outcome-odds-selector':
      return [
        {
          title: 'Select the active side coin',
          description: 'Use the selector before charts, books, or tickets need a side.',
          steps: [
            'Control the selected coin in the parent.',
            'Forward the selected coin to the order book.',
            'Lock selection when a ticket enters review.',
          ],
          relatedSlug: 'outcome-order-book',
          relatedLabel: 'Inspect liquidity',
        },
      ]
    case 'outcome-order-book':
      return [
        {
          title: 'Build a liquidity check',
          description: 'Use one side book as the read-only gate before ticket handoff.',
          steps: [
            'Resolve the selected side coin.',
            'Read l2Book for that coin only.',
            'Suppress ticket defaults when the book is empty or stale.',
          ],
          relatedSlug: 'order-ticket-mock',
          relatedLabel: 'Hand off to ticket',
        },
        {
          title: 'Render an empty book honestly',
          description: 'Do not invent depth for new or illiquid outcome markets.',
          steps: [
            'Keep the side label and coin visible.',
            'Show the empty state instead of zero-price rows.',
            'Let the parent decide whether order intent is allowed.',
          ],
        },
      ]
    case 'outcome-position-row':
      return [
        {
          title: 'Resolve portfolio holdings',
          description: 'Turn raw side coin balances into readable rows.',
          steps: [
            'Read wallet spot balances.',
            'Use createOutcomePositionRows to map held coins back to outcome metadata.',
            'Render market, side, mark, and settlement state.',
          ],
        },
        {
          title: 'Build a watchlist row',
          description: 'Use the same row shape without requiring a wallet balance.',
          steps: [
            'Store followed market ids in the parent app.',
            'Resolve side labels from outcomeMeta.',
            'Show mark or probability when a book is available.',
          ],
        },
      ]
    case 'order-ticket-mock':
      return [
        {
          title: 'Wallet-gated handoff',
          description: 'Use the ticket after read-only surfaces have selected a pair or side.',
          steps: [
            'Receive selected pair, side, size, and limit price from parent state.',
            'Use createSpotOrderDraft for draft checks and signer-ready placeOrderInput.',
            'Keep wallet, balances, exchange errors, and final submission in the parent app.',
            'Submit only from your exchange boundary, never from the demo.',
          ],
          relatedSlug: 'outcome-order-book',
          relatedLabel: 'Review book first',
        },
      ]
    default:
      return []
  }
}
