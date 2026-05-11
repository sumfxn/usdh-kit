import {
  ArrowRight,
  BookOpen,
  Boxes,
  Braces,
  ChartNoAxesColumn,
  CircleDot,
  Coins,
  ExternalLink,
  GitBranch,
  Landmark,
  LineChart,
  type LucideIcon,
  Network,
  PackageCheck,
  Radar,
  Route,
  Terminal,
  WalletCards,
} from 'lucide-react'

import { ConnectButton } from '../components/ConnectButton'
import { SwapSection } from '../components/SwapSection'
import { type GalleryBookLevel, loadGallerySnapshot } from '../lib/gallery-data'

export const revalidate = 60

const surfaces: Array<{
  title: string
  eyebrow: string
  body: string
  icon: LucideIcon
}> = [
  {
    title: 'Discover USDH pairs',
    eyebrow: 'Track 1',
    body: 'Spot markets where USDH is base or quote, with live pair names and token orientation.',
    icon: Radar,
  },
  {
    title: 'Read outcomes',
    eyebrow: 'Track 2',
    body: 'Experimental read-only outcome metadata, encoded side coins, books, and mids.',
    icon: ChartNoAxesColumn,
  },
  {
    title: 'Trade USDH spots',
    eyebrow: 'Track 3',
    body: 'USDH-scoped order placement, cancellation, open orders, and status reads.',
    icon: LineChart,
  },
  {
    title: 'Move through flows',
    eyebrow: 'Track 4',
    body: 'USDC -> USDH, USDH -> USDC, HyperEVM -> Core, and Core -> HyperEVM helpers.',
    icon: Route,
  },
]

const primitives: Array<{
  title: string
  detail: string
  icon: LucideIcon
  code: string
}> = [
  {
    title: 'Market discovery',
    detail: 'Find USDH surfaces without hand-parsing Hyperliquid metadata.',
    icon: Network,
    code: "const pairs = await kit.listPairs({ quote: 'USDH' })",
  },
  {
    title: 'Quote and route',
    detail: 'Preflight source-chain choice before asking users to sign anything.',
    icon: GitBranch,
    code: "const route = await kit.getRoute({ from: 'USDC', amount })",
  },
  {
    title: 'Outcome reads',
    detail: 'Keep outcome support experimental and read-only until settlement is verified.',
    icon: Boxes,
    code: 'const markets = await kit.listOutcomeMarkets()',
  },
  {
    title: 'Targeted orders',
    detail: 'Place and cancel orders only on USDH-bearing spot pairs.',
    icon: Braces,
    code: "await kit.placeOrder({ pair: 'USDH/USDC', side: 'sell', size: '25' })",
  },
  {
    title: 'Bridge and swap',
    detail: 'Route, bridge when needed, then submit the HyperCore swap.',
    icon: WalletCards,
    code: "await kit.bridgeAndSwap({ from: 'USDC', amount })",
  },
  {
    title: 'Bridge out',
    detail: 'Submit Core -> HyperEVM sendAsset and return a clear submitted state.',
    icon: Landmark,
    code: "await kit.bridgeFromCore({ asset: 'USDC', amount })",
  },
]

const examples = [
  ['Node swap', 'Smallest CLI path for quote, route, bridge, swap.'],
  ['Payment webhook', 'Convert received USDC into USDH after checkout settlement.'],
  ['Treasury rebalance', 'Keep a USDH allocation above a configurable floor.'],
  ['Builder gallery', 'Use these cards as the visual reference for new examples.'],
] as const

export default async function Home() {
  const snapshot = await loadGallerySnapshot()
  const generatedAt = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(snapshot.generatedAt))

  return (
    <main className="min-h-screen bg-[#f7f7f6] text-neutral-950 dark:bg-[#080808] dark:text-neutral-50">
      <div className="mx-4 flex min-w-0 max-w-[358px] flex-col gap-16 py-5 sm:mx-auto sm:w-full sm:max-w-7xl sm:px-6 lg:px-8">
        <header className="flex min-h-10 min-w-0 items-center justify-between gap-3">
          <a
            href="/"
            className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md border border-neutral-300 bg-white font-mono text-[11px] dark:border-neutral-800 dark:bg-neutral-950">
              u
            </span>
            usdh-kit
          </a>
          <nav className="hidden items-center gap-5 text-xs text-neutral-600 dark:text-neutral-400 md:flex">
            <a href="#surfaces" className="transition hover:text-neutral-950 dark:hover:text-white">
              Surfaces
            </a>
            <a href="#markets" className="transition hover:text-neutral-950 dark:hover:text-white">
              Markets
            </a>
            <a href="#widget" className="transition hover:text-neutral-950 dark:hover:text-white">
              Widget
            </a>
            <a href="#examples" className="transition hover:text-neutral-950 dark:hover:text-white">
              Examples
            </a>
          </nav>
          <div className="hidden shrink-0 sm:block">
            <ConnectButton />
          </div>
        </header>

        <section className="grid min-w-0 grid-cols-1 gap-8 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="min-w-0 max-w-3xl">
            <div className="mb-5 inline-flex h-8 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <StatusDot live={snapshot.mode === 'live'} />
              {snapshot.mode === 'live' ? 'Live mainnet read-only' : 'Sample data fallback'}
            </div>
            <h1 className="max-w-full text-balance break-words text-5xl font-semibold tracking-normal text-neutral-950 dark:text-white sm:max-w-3xl sm:text-6xl lg:text-7xl">
              USDH builder primitives for Hyperliquid.
            </h1>
            <p className="mt-6 max-w-full break-words text-base leading-7 text-neutral-600 dark:text-neutral-400 sm:max-w-2xl sm:text-lg">
              `usdh-kit` is the focused SDK and widget for builders who want to discover, route,
              trade, and display USDH surfaces without becoming a generic Hyperliquid integration
              team.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="https://github.com/sumfxn/usdh-kit"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-black dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                <Terminal className="h-4 w-4" />
                GitHub
              </a>
              <a
                href="#widget"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-700"
              >
                <PackageCheck className="h-4 w-4" />
                Try the widget
              </a>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 rounded-md border border-neutral-300 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 text-xs dark:border-neutral-800">
              <span className="font-mono text-neutral-500">SDK surface</span>
              <span className="text-neutral-500">{generatedAt}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Metric label="tracks landed" value="4" detail="Track 5 paused" />
              <Metric label="write paths" value="scoped" detail="USDH pairs only" />
              <Metric label="live mode" value={snapshot.mode} detail={snapshot.notes[0]} />
              <Metric label="release" value="gated" detail="IRL validation first" />
            </div>
          </div>
        </section>

        <section id="surfaces" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionIntro
            kicker="USDH surface map"
            title="One kit for the surfaces that matter."
            body="The project stays intentionally USDH-scoped: discovery, outcomes, spot orders, and useful bridge/swap flows. HyperEVM direct swaps stay paused until routing is validated."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {surfaces.map((surface) => (
              <SurfaceCard key={surface.title} {...surface} />
            ))}
          </div>
        </section>

        <section id="markets" className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-md border border-neutral-300 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <PanelHeader
              icon={Radar}
              title="USDH market board"
              meta={snapshot.mode === 'live' ? 'mainnet' : 'sample'}
            />
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {snapshot.pairs.map((pair) => (
                <div
                  key={`${pair.name}-${pair.index}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{pair.label}</div>
                    <div className="mt-1 font-mono text-xs text-neutral-500">
                      {pair.name} / index {pair.index}
                    </div>
                  </div>
                  <span className="hidden rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400 sm:inline-flex">
                    USDH {pair.role}
                  </span>
                  <span className="font-mono text-sm">{pair.mid}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-neutral-300 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <PanelHeader
              icon={BookOpen}
              title={`Book snapshot ${snapshot.book.coin}`}
              meta="top 3"
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <BookSide title="Bids" levels={snapshot.book.bids} />
              <BookSide title="Asks" levels={snapshot.book.asks} align="right" />
            </div>
            <div className="border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800">
              {snapshot.notes.join(' / ')}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-md border border-neutral-300 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <PanelHeader icon={Coins} title="Outcome reads" meta="experimental" />
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {snapshot.outcomes.map((outcome) => (
                <div key={outcome.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-sm font-medium">{outcome.name}</div>
                    <div className="font-mono text-xs text-neutral-500">{outcome.coin}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <span className="rounded-md border border-neutral-200 px-2 py-1 dark:border-neutral-800">
                      {outcome.sides[0]}
                    </span>
                    <span className="rounded-md border border-neutral-200 px-2 py-1 dark:border-neutral-800">
                      {outcome.sides[1]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="grid min-h-[252px] gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <FlowNode icon={WalletCards} title="HyperEVM" body="USDC source wallet" />
              <ArrowRight className="hidden h-5 w-5 text-neutral-400 sm:block" />
              <FlowNode icon={Landmark} title="HyperCore" body="Bridge credit and spot balance" />
              <ArrowRight className="hidden h-5 w-5 text-neutral-400 sm:col-start-2 sm:block" />
              <FlowNode icon={Coins} title="USDH" body="Swap, order, read outcomes" wide />
            </div>
          </div>
        </section>

        <section id="widget" className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionIntro
            kicker="Widget"
            title="A drop-in flow, not just snippets."
            body="The widget keeps wallet connection secondary to the builder story, but it stays live and usable for the core USDC -> USDH path."
          />
          <div className="flex justify-center rounded-md border border-neutral-300 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <SwapSection />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <SectionIntro
            kicker="SDK primitives"
            title="Small surfaces, sharp contracts."
            body="Each primitive is intentionally narrow. The SDK should be the reference for USDH integrations, not a generic wrapper around every Hyperliquid endpoint."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {primitives.map((primitive) => (
              <PrimitiveCard key={primitive.title} {...primitive} />
            ))}
          </div>
        </section>

        <section id="examples" className="grid gap-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <SectionIntro
              kicker="Examples"
              title="Reference paths builders can copy."
              body="The gallery is the visual front door; examples stay small, runnable, and focused on one integration job each."
            />
            <a
              href="https://github.com/sumfxn/usdh-kit/tree/main/apps/examples"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-700"
            >
              Browse examples
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {examples.map(([title, body]) => (
              <div
                key={title}
                className="rounded-md border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <CircleDot className="h-4 w-4 text-neutral-500" />
                <h3 className="mt-5 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-neutral-300 py-6 text-xs text-neutral-500 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
          <span>Built by Sumfxn and Yaugourt for USDH builders.</span>
          <span className="font-mono">no release from this gallery PR</span>
        </footer>
      </div>
    </main>
  )
}

function StatusDot({ live }: { live: boolean }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-neutral-950 dark:bg-white' : 'bg-neutral-400'}`}
      aria-hidden="true"
    />
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">{label}</div>
      <div className="mt-3 font-mono text-lg text-neutral-950 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{detail}</div>
    </div>
  )
}

function SectionIntro({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="min-w-0 max-w-full sm:max-w-xl">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
        {kicker}
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-normal text-neutral-950 dark:text-white">
        {title}
      </h2>
      <p className="mt-4 break-words text-sm leading-7 text-neutral-600 dark:text-neutral-400">
        {body}
      </p>
    </div>
  )
}

function SurfaceCard({
  title,
  eyebrow,
  body,
  icon: Icon,
}: {
  title: string
  eyebrow: string
  body: string
  icon: LucideIcon
}) {
  return (
    <div className="rounded-md border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-neutral-500" />
        <span className="font-mono text-[11px] text-neutral-500">{eyebrow}</span>
      </div>
      <h3 className="mt-8 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{body}</p>
    </div>
  )
}

function PanelHeader({
  icon: Icon,
  title,
  meta,
}: {
  icon: LucideIcon
  title: string
  meta: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-neutral-500" />
        {title}
      </div>
      <span className="font-mono text-xs text-neutral-500">{meta}</span>
    </div>
  )
}

function BookSide({
  title,
  levels,
  align = 'left',
}: {
  title: string
  levels: GalleryBookLevel[]
  align?: 'left' | 'right'
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
        {title}
      </div>
      <div className="space-y-2">
        {levels.map((level, index) => (
          <div key={`${level.price}-${index}`} className="relative overflow-hidden rounded-md">
            <div
              className={`absolute inset-y-0 ${align === 'right' ? 'right-0' : 'left-0'} bg-neutral-200 dark:bg-neutral-800`}
              style={{ width: `${Math.max(18, 82 - index * 18)}%` }}
            />
            <div className="relative grid grid-cols-[1fr_auto] gap-3 px-3 py-2 font-mono text-xs">
              <span>{level.price}</span>
              <span className="text-neutral-600 dark:text-neutral-400">
                {level.size} / {level.orders}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FlowNode({
  icon: Icon,
  title,
  body,
  wide = false,
}: {
  icon: LucideIcon
  title: string
  body: string
  wide?: boolean
}) {
  return (
    <div
      className={`rounded-md border border-neutral-200 p-4 dark:border-neutral-800 ${
        wide ? 'sm:col-span-3' : ''
      }`}
    >
      <Icon className="h-5 w-5 text-neutral-500" />
      <h3 className="mt-6 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{body}</p>
    </div>
  )
}

function PrimitiveCard({
  title,
  detail,
  code,
  icon: Icon,
}: {
  title: string
  detail: string
  code: string
  icon: LucideIcon
}) {
  return (
    <div className="rounded-md border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <Icon className="h-4 w-4 text-neutral-500" />
      <h3 className="mt-5 text-sm font-semibold">{title}</h3>
      <p className="mt-2 min-h-12 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {detail}
      </p>
      <pre className="mt-4 overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs leading-5 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
        <code>{code}</code>
      </pre>
    </div>
  )
}
