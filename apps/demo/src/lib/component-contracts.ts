import type { ComponentSlug } from './component-registry'

export interface ComponentPropSpec {
  name: string
  type: string
  description: string
  required?: boolean
}

export interface ComponentStateSpec {
  name: string
  description: string
}

export interface ComponentContract {
  props: ComponentPropSpec[]
  states: ComponentStateSpec[]
  accessibility: string
}

const outcomeEventType = 'OutcomeEventData'
const outcomePositionType = 'OutcomePositionData'

export function getComponentContract(slug: ComponentSlug): ComponentContract {
  switch (slug) {
    case 'usdh-widget':
      return {
        props: [
          {
            name: 'network',
            type: "'mainnet' | 'testnet'",
            description: 'HyperEVM network used by the packaged widget.',
            required: true,
          },
          {
            name: 'defaultAmount',
            type: 'string',
            description: 'Optional initial USDC amount shown in the widget input.',
          },
          {
            name: 'theme',
            type: "'auto' | 'dark' | 'light'",
            description: 'Widget theme. Use auto unless the host surface is locked.',
          },
          {
            name: 'onSwapComplete',
            type: '(result) => void',
            description: 'Called by the packaged widget after a successful wallet-gated swap.',
          },
        ],
        states: [
          { name: 'pre-wallet', description: 'Show quote context while writes stay locked.' },
          { name: 'connected', description: 'Balances and route checks can enable the swap path.' },
          { name: 'bridging', description: 'Bridge progress is shown inside the packaged widget.' },
          { name: 'done', description: 'Completion receipt and balances refresh after fill.' },
        ],
        accessibility:
          'Keep the widget title visible, preserve button disabled states, and keep external quote context read-only.',
      }
    case 'market-board':
      return {
        props: [
          {
            name: 'pair',
            type: 'string',
            description: 'Human pair label, for example USDH/USDC.',
            required: true,
          },
          {
            name: 'pay',
            type: 'string',
            description: 'Formatted input amount and token.',
            required: true,
          },
          {
            name: 'receive',
            type: 'string',
            description: 'Formatted estimated output amount.',
            required: true,
          },
          {
            name: 'spreadBps',
            type: 'number | null',
            description: 'Top-of-book spread in basis points.',
          },
          {
            name: 'depthUsd',
            type: 'number | null',
            description: 'Approximate usable depth near top-of-book.',
          },
          {
            name: 'status',
            type: "'ready' | 'stale' | 'blocked'",
            description: 'Quote readiness state.',
          },
        ],
        states: [
          { name: 'ready', description: 'Pair, book, spread, and receive estimate are available.' },
          {
            name: 'stale',
            description: 'Render cached values quietly while a background refresh runs.',
          },
          {
            name: 'blocked',
            description: 'Depth, spread, or pair discovery prevents a sensible quote.',
          },
          { name: 'empty', description: 'No USDH pair is available from spot metadata.' },
        ],
        accessibility:
          'Use text labels for pair and amounts; do not encode quote readiness with color alone.',
      }
    case 'quote-readiness':
      return {
        props: [
          {
            name: 'pair',
            type: 'string',
            description: 'Human pair label for the checked market, for example USDH/USDC.',
            required: true,
          },
          {
            name: 'checks',
            type: "Array<{ label: string; state: 'ready' | 'blocked' | 'stale'; value: string }>",
            description: 'Readiness checks derived by the parent from pair and book reads.',
            required: true,
          },
          {
            name: 'compact',
            type: 'boolean',
            description: 'Reduces the row for quote buttons and ticket headers.',
          },
        ],
        states: [
          { name: 'ready', description: 'Pair, book, spread, and depth checks pass.' },
          {
            name: 'blocked',
            description:
              'A missing pair, empty book, wide spread, or low depth blocks quote intent.',
          },
          {
            name: 'stale',
            description: 'Cached checks are shown while a background refresh runs.',
          },
        ],
        accessibility: 'Each check needs text value and state. Dots and color are decorative only.',
      }
    case 'outcome-reads':
      return {
        props: [
          {
            name: 'event',
            type: outcomeEventType,
            description: 'Normalized market data with two resolved side quotes.',
            required: true,
          },
          {
            name: 'compact',
            type: 'boolean',
            description: 'Reduces spacing for feed cards and watchlists.',
          },
          {
            name: 'showBookContext',
            type: 'boolean',
            description: 'Adds side coin, top-book, and spread details for market headers.',
          },
          {
            name: 'selectedSideIndex',
            type: '0 | 1',
            description: 'Optional controlled selected side.',
          },
          {
            name: 'onSideChange',
            type: '(quote, index) => void',
            description: 'Called when the user chooses a different side in the card.',
          },
        ],
        states: outcomeReadStates(),
        accessibility:
          'Expose the selected side, probability, and price as text. Progress bars are decorative only.',
      }
    case 'outcome-market-row':
      return {
        props: [
          {
            name: 'events',
            type: 'OutcomeEventData[]',
            description: 'Normalized outcome events for the list.',
            required: true,
          },
          {
            name: 'selectedId',
            type: 'number | string',
            description: 'Current selected outcome id.',
            required: true,
          },
          {
            name: 'onSelect',
            type: '(id: number | string) => void',
            description: 'Selection handler owned by the parent list or router.',
            required: true,
          },
        ],
        states: [
          { name: 'default', description: 'Normal row with resolved sides and prices.' },
          {
            name: 'selected',
            description: 'Subtle active row for picker or master/detail layouts.',
          },
          { name: 'loading', description: 'Skeleton row while outcomeMeta or mids load.' },
          { name: 'empty', description: 'No markets match the current filter.' },
        ],
        accessibility:
          'Rows should be buttons or links with a clear label. Keep side prices reachable as text.',
      }
    case 'outcome-odds-selector':
      return {
        props: [
          {
            name: 'event',
            type: 'OutcomeEventData',
            description: 'Selected outcome event with two side quotes.',
            required: true,
          },
          {
            name: 'disabled',
            type: 'boolean',
            description: 'Locks side selection during order review or loading.',
          },
          {
            name: 'value',
            type: '`#${number}`',
            description: 'Optional controlled side coin.',
          },
          {
            name: 'onValueChange',
            type: '(coin, quote, index) => void',
            description: 'Selection callback for order forms and detail pages.',
          },
        ],
        states: [
          { name: 'selected', description: 'One side is active and mapped to a side coin.' },
          { name: 'disabled', description: 'Selection is visible but locked by parent flow.' },
          {
            name: 'loading',
            description: 'Side labels are known but live books are still loading.',
          },
          {
            name: 'custom labels',
            description: 'Side labels may be non Yes/No for labelled markets.',
          },
        ],
        accessibility:
          'Use a radiogroup or two buttons with pressed state; never require color to identify selection.',
      }
    case 'outcome-order-book':
      return {
        props: [
          {
            name: 'event',
            type: 'OutcomeEventData',
            description: 'Selected outcome event; the component owns the visible side toggle.',
            required: true,
          },
          {
            name: 'empty',
            type: 'boolean',
            description: 'Renders the no-level state without fake depth.',
          },
          {
            name: 'sideIndex',
            type: '0 | 1',
            description: 'Optional controlled side book index.',
          },
          {
            name: 'levelsByCoin',
            type: 'Record<string, OutcomeOrderBookSideLevels>',
            description: 'Optional real l2Book levels keyed by selected side coin.',
          },
          {
            name: 'onSideChange',
            type: '(quote, index) => void',
            description: 'Called when the visible book side changes.',
          },
        ],
        states: [
          { name: 'live', description: 'Book has bid/ask levels for the selected side coin.' },
          {
            name: 'crossed/invalid',
            description: 'Parent code should detect impossible spread and suppress quote.',
          },
          { name: 'empty', description: 'No levels are available for a new or illiquid market.' },
          { name: 'stale', description: 'Cached book is rendered while background refresh runs.' },
        ],
        accessibility:
          'Use table-like labels for side, price, and size. Depth bars should be decorative.',
      }
    case 'outcome-position-row':
      return {
        props: [
          {
            name: 'positions',
            type: `${outcomePositionType}[]`,
            description: 'Resolved held or watched HIP-4 side coin rows.',
            required: true,
          },
          {
            name: 'compact',
            type: 'boolean',
            description: 'Limits visible rows for watchlist or drawer use.',
          },
        ],
        states: [
          { name: 'held', description: 'Wallet owns a non-zero side coin balance.' },
          { name: 'watch', description: 'User follows the market without a balance.' },
          {
            name: 'settled',
            description: 'Market resolved; row should show side outcome and payout status.',
          },
          { name: 'empty', description: 'No HIP-4 positions found for the wallet.' },
        ],
        accessibility:
          'Keep market, side, coin, and balance in text columns. Avoid icon-only settlement state.',
      }
    case 'order-ticket-mock':
      return {
        props: [
          { name: 'pair', type: 'string', description: 'Trading pair label.', required: true },
          { name: 'side', type: "'buy' | 'sell'", description: 'Order side.', required: true },
          {
            name: 'size',
            type: 'string',
            description: 'Input size shown in base units.',
            required: true,
          },
          {
            name: 'limitPrice',
            type: 'string',
            description: 'Limit price for draft and review states.',
          },
          {
            name: 'canReview',
            type: 'boolean',
            description: 'Derived from createSpotOrderDraft checks before wallet handoff.',
          },
          {
            name: 'checks',
            type: 'SpotOrderDraftCheck[]',
            description: 'Readable validation rows for size, price, balance, and quote readiness.',
          },
          {
            name: 'onReview',
            type: '(placeOrderInput) => void',
            description: 'Called with a signer-ready draft that the parent may submit.',
          },
        ],
        states: [
          { name: 'draft', description: 'Editable local form state.' },
          { name: 'review', description: 'Inputs locked while parent shows signer preflight.' },
          { name: 'submitted', description: 'Receipt-style state for mock or completed order.' },
          {
            name: 'blocked',
            description: 'Invalid size, invalid price, missing signer, or insufficient balance.',
          },
        ],
        accessibility:
          'Inputs need visible labels and disabled submit state. Review must summarize size, side, and price in text.',
      }
    default:
      return {
        props: [],
        states: [],
        accessibility: 'Legacy compatibility route. Not part of the primary product registry.',
      }
  }
}

function outcomeReadStates(): ComponentStateSpec[] {
  return [
    { name: 'default', description: 'Both sides have readable prices and side coins.' },
    { name: 'loading', description: 'Metadata is known but live books or mids are still loading.' },
    { name: 'stale', description: 'Cached reads are rendered while a background refresh runs.' },
    { name: 'illiquid', description: 'One or both sides have missing top-of-book data.' },
  ]
}
