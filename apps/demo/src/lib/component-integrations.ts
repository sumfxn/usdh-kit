import type { ComponentSlug } from './component-registry'

export interface ComponentCopyContract {
  adapter: string
  pattern: string
  parentOwns: string
}

export interface ComponentIntegration {
  copyContract?: ComponentCopyContract
  data: string[]
  parentOwns: string[]
  productionChecks: string[]
}

const hip4ReadOnlyChecks = [
  'Use cached live reads; never block navigation.',
  'Handle loading, stale, empty, and illiquid states.',
  'Keep trades in a wallet-gated parent flow.',
]

function outcomeCopyContract(helper: string, pattern: string): ComponentCopyContract {
  return {
    adapter: `${helper} from @usdh-kit/sdk maps outcomeMeta and l2Book reads into props.`,
    pattern: `Copy ${pattern} as the UI surface; keep SDK reads outside the component.`,
    parentOwns: 'Routing, selected state, cache, wallet state, and every write boundary.',
  }
}

export function getComponentIntegration(slug: ComponentSlug): ComponentIntegration {
  switch (slug) {
    case 'usdh-widget':
      return {
        data: [
          'Optional pre-wallet quote context.',
          'Widget props: network, defaultAmount, theme, callbacks.',
        ],
        parentOwns: [
          'Wallet provider and route placement.',
          'Surrounding quote context and analytics.',
        ],
        productionChecks: [
          'Verify network switching and wallet connect.',
          'Keep completion callbacks idempotent.',
          'Do not bypass the packaged widget write boundary.',
        ],
      }
    case 'market-board':
      return {
        copyContract: {
          adapter:
            'Use createQuoteSummaryData from @usdh-kit/sdk to derive receive estimate, spread, depth, and block reason.',
          pattern: 'Copy Quote Summary beside a swap form or review drawer.',
          parentOwns: 'Amount input, pair selection, refresh policy, wallet, and submit flow.',
        },
        data: [
          'USDH pair from spot metadata.',
          'Top-of-book bid/ask from l2Book.',
          'Pay amount, receive estimate, spread, depth, and readiness.',
        ],
        parentOwns: [
          'Amount input and quote button state.',
          'Refresh policy, stale cache, and pair selection.',
        ],
        productionChecks: [
          'Suppress ready state when pair, spread, or depth is invalid.',
          'Do not quote an empty book.',
          'Keep submission in a wallet-gated parent flow.',
        ],
      }
    case 'quote-readiness':
      return {
        copyContract: {
          adapter:
            'createQuoteReadiness from @usdh-kit/sdk maps pair and top-of-book reads into checks.',
          pattern: 'Copy Quote Readiness near quote buttons, ticket headers, or review drawers.',
          parentOwns:
            'Amount, pair, cache freshness, disabled state, wallet, and every write path.',
        },
        data: [
          'Selected USDH pair.',
          'Top-of-book bid/ask from l2Book.',
          'Spread, depth, stale state, and quote block reason.',
        ],
        parentOwns: [
          'Thresholds for spread and depth.',
          'Polling, stale cache, and hidden-tab pause.',
          'Disabled button state and final quote/ticket handoff.',
        ],
        productionChecks: [
          'Block readiness when bid or ask is missing.',
          'Surface stale reads without blocking navigation.',
          'Keep all write behavior outside this row.',
        ],
      }
    case 'outcome-reads':
      return {
        copyContract: outcomeCopyContract('createOutcomeEventData', 'OutcomeEventCard'),
        data: [
          'Outcome title, sides, side coins, and id.',
          'Best bid/ask or mid-derived probability.',
        ],
        parentOwns: [
          'Market detail routing.',
          'Live read cache and fallback policy.',
          'Trade buttons, tickets, and wallet state.',
        ],
        productionChecks: [
          ...hip4ReadOnlyChecks,
          'Support non Yes/No side labels.',
          'Do not imply liquidity when books are empty.',
        ],
      }
    case 'outcome-market-row':
      return {
        copyContract: outcomeCopyContract('createOutcomeMarketRows', 'OutcomeMarketRows'),
        data: [
          'List of normalized outcome markets.',
          'Side prices keyed by side coin.',
          'Stable market id for selection.',
        ],
        parentOwns: ['Search, sort, pagination, and selection.', 'Navigation into market detail.'],
        productionChecks: [
          ...hip4ReadOnlyChecks,
          'Stress long titles and dense mobile lists.',
          'Keep side coin mapping available.',
        ],
      }
    case 'outcome-odds-selector':
      return {
        copyContract: outcomeCopyContract('createOutcomeSideSelection', 'OutcomeOddsSelector'),
        data: [
          'Selected market title.',
          'Side label, coin, price, and probability.',
          'Controlled selected side coin value.',
        ],
        parentOwns: [
          'Editable vs locked review state.',
          'Selected side propagation to book or ticket.',
        ],
        productionChecks: [
          ...hip4ReadOnlyChecks,
          'Use pressed/radio state, not color alone.',
          'Lock the selector once an order review is staged.',
        ],
      }
    case 'outcome-order-book':
      return {
        copyContract: outcomeCopyContract('createOutcomeOrderBookSummary', 'OutcomeOrderBook'),
        data: [
          'Selected side coin.',
          'Bid and ask levels from l2Book for that side coin.',
          'Optional spread, mid, and depth.',
        ],
        parentOwns: [
          'Side selection and refresh lifecycle.',
          'Price-level click behavior for tickets.',
        ],
        productionChecks: [
          ...hip4ReadOnlyChecks,
          'Detect crossed, empty, or stale books.',
          'Prefer subscriptions on active trading pages.',
        ],
      }
    case 'outcome-position-row':
      return {
        copyContract: outcomeCopyContract('createOutcomePositionRows', 'OutcomePositionRows'),
        data: [
          'Held side coin balances.',
          'Outcome metadata to resolve market and side.',
          'Optional mark price for portfolio display.',
        ],
        parentOwns: [
          'Wallet address, refresh, and grouping.',
          'PnL, fills, settlement, and payout logic.',
        ],
        productionChecks: [
          'Resolve unknown side coins gracefully.',
          'Add settled, won, lost, and payout states.',
          'Do not require trading permissions for read-only holdings.',
        ],
      }
    case 'order-ticket-mock':
      return {
        copyContract: {
          adapter:
            'Use createSpotOrderDraft from @usdh-kit/sdk to derive checks and placeOrderInput.',
          pattern: 'Copy the ticket shell and keep submit behind your signer boundary.',
          parentOwns: 'Signer, balances, exchange errors, and final submission.',
        },
        data: [
          'Selected USDH spot pair.',
          'Draft side, size, price, order type, and review mode.',
          'Optional book context for validation.',
        ],
        parentOwns: [
          'Signer, exchange client, and wallet state.',
          'Tick-size rules, balances, slippage policy, and account permissions.',
          'Final exchange write submission.',
        ],
        productionChecks: [
          'Do not wire this mock directly to /exchange.',
          'Use the SDK draft checks before enabling review.',
          'Surface exchange errors and partial-fill/resting states explicitly.',
        ],
      }
    default:
      return {
        data: ['Legacy compatibility route.'],
        parentOwns: ['Not part of the primary registry.'],
        productionChecks: [
          'Keep accessible for existing URLs, but do not promote as a main pattern.',
        ],
      }
  }
}
