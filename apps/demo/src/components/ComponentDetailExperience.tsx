'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { getComponentContract } from '../lib/component-contracts'
import { type ComponentCopyContract, getComponentIntegration } from '../lib/component-integrations'
import { type ComponentRecipe, getComponentRecipes } from '../lib/component-recipes'
import {
  type ComponentEntry,
  type ComponentSlug,
  type RegistryDataMode,
  componentHref,
  getBuilderPathStep,
  getComponentEntry,
} from '../lib/component-registry'
import { type ComponentSdkRead, getComponentSdkReads } from '../lib/component-sdk-reads'
import type { GallerySnapshot } from '../lib/gallery-data'
import { ComponentPreview } from './ComponentPreview'
import { CodeBlock } from './registry/code-block'
import { VariantSection } from './registry/preview-primitives'

interface ComponentDetailExperienceProps {
  slug: ComponentSlug
  dataMode: RegistryDataMode
  snapshot: GallerySnapshot
}

export function ComponentDetailExperience({
  slug,
  dataMode,
  snapshot,
}: ComponentDetailExperienceProps) {
  const entry = getComponentEntry(slug)
  const [activeSnippetIndex, setActiveSnippetIndex] = useState(0)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const router = useRouter()
  const [, startRefresh] = useTransition()
  const canRefresh = dataMode === 'live' && Boolean(entry?.liveCapable)

  useEffect(() => {
    if (!canRefresh) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      startRefresh(() => router.refresh())
    }, 8_000)
    return () => window.clearInterval(timer)
  }, [canRefresh, router])

  if (!entry) return null

  const activeSnippet = entry.snippets[activeSnippetIndex] ?? entry.snippets[0]
  const usageSnippet = entry.usage ?? activeSnippet
  const variants = entry.variants ?? []
  const recipes = getComponentRecipes(entry.slug)
  const sdkReads = getComponentSdkReads(entry.slug)
  const snippetSelector =
    entry.snippets.length > 1 ? (
      <SnippetSelector
        entry={entry}
        activeSnippetIndex={activeSnippetIndex}
        onChange={setActiveSnippetIndex}
      />
    ) : undefined

  function copyText(key: string, code: string) {
    void writeClipboardText(code).then((copied) => {
      if (!copied) return
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 1200)
    })
  }

  return (
    <article className="registry-fade-up mx-auto min-w-0 w-full max-w-full space-y-7 overflow-hidden xl:max-w-[980px]">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 text-xs font-medium text-neutral-500">{entry.eyebrow}</div>
            <h1 className="break-words text-2xl font-semibold tracking-normal text-neutral-950 text-balance dark:text-neutral-50 sm:text-3xl">
              {entry.title}
            </h1>
            <p className="mt-2 max-w-[21rem] break-words text-sm leading-6 text-neutral-600 dark:text-neutral-400 sm:max-w-2xl">
              {entry.description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/components" prefetch={false}>
                Back to registry
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <ExampleBlock
        actions={snippetSelector}
        code={activeSnippet?.code ?? ''}
        language={activeSnippet?.language}
        copied={copiedKey === 'source'}
        onCopy={() => copyText('source', activeSnippet?.code ?? '')}
      >
        <ComponentPreview slug={entry.slug} snapshot={snapshot} dataMode={dataMode} />
      </ExampleBlock>

      <CopyGuideSection entry={entry} />

      {variants.length > 0 ? (
        <DocsSection title="Examples">
          <div className="space-y-7">
            {variants.map((variant) => (
              <VariantSection
                key={variant.id}
                title={variant.title}
                description={variant.description}
              >
                <ExampleBlock
                  code={variant.snippet.code}
                  language={variant.snippet.language}
                  copied={copiedKey === `variant-${variant.id}`}
                  onCopy={() => copyText(`variant-${variant.id}`, variant.snippet.code)}
                >
                  <ComponentPreview
                    slug={entry.slug}
                    snapshot={snapshot}
                    dataMode={dataMode}
                    size="compact"
                    previewId={variant.previewId}
                  />
                </ExampleBlock>
              </VariantSection>
            ))}
          </div>
        </DocsSection>
      ) : null}

      {sdkReads.length > 0 ? <SdkReadsSection reads={sdkReads} /> : null}

      <PatternApiSection entry={entry} />

      {recipes.length > 0 ? <RecipeSection recipes={recipes} /> : null}

      <DocsSection title="Installation">
        <CodeBlock
          code={entry.installCommand ?? installCommand(entry)}
          language="shell"
          copied={copiedKey === 'install'}
          onCopy={() => copyText('install', entry.installCommand ?? installCommand(entry))}
        />
      </DocsSection>

      <DocsSection title="Usage">
        <CodeBlock
          code={usageSnippet?.code ?? ''}
          language={usageSnippet?.language}
          copied={copiedKey === 'usage'}
          onCopy={() => copyText('usage', usageSnippet?.code ?? '')}
        />
      </DocsSection>

      {entry.composition ? (
        <DocsSection title="Composition">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {entry.composition}
              </p>
            </CardContent>
          </Card>
        </DocsSection>
      ) : null}

      <BuilderPathNav entry={entry} />
    </article>
  )
}

function ExampleBlock({
  children,
  actions,
  code,
  language,
  copied,
  onCopy,
}: {
  children: ReactNode
  actions?: ReactNode
  code: string
  language?: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <section className="min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {actions ? (
        <div className="flex min-h-11 items-center justify-end border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
          {actions}
        </div>
      ) : null}
      <div className="min-w-0 w-full max-w-full overflow-hidden bg-neutral-50 p-3 dark:bg-neutral-950 sm:p-4">
        {children}
      </div>
      <CodeBlock code={code} language={language} copied={copied} onCopy={onCopy} embedded />
    </section>
  )
}

function SnippetSelector({
  entry,
  activeSnippetIndex,
  onChange,
}: {
  entry: ComponentEntry
  activeSnippetIndex: number
  onChange: (index: number) => void
}) {
  if (entry.snippets.length <= 1) return null
  return (
    <ToggleGroup
      type="single"
      value={String(activeSnippetIndex)}
      className="w-full flex-wrap justify-start gap-1 sm:w-fit"
      onValueChange={(value) => {
        if (value) onChange(Number(value))
      }}
      aria-label="Choose snippet"
    >
      {entry.snippets.map((snippet, index) => (
        <ToggleGroupItem key={snippet.title} value={String(index)}>
          {snippet.title}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function DocsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
      {children}
    </section>
  )
}

function RecipeSection({ recipes }: { recipes: ComponentRecipe[] }) {
  return (
    <DocsSection title="Recipes">
      <div className="grid gap-3 md:grid-cols-2">
        {recipes.map((recipe) => (
          <Card key={recipe.title}>
            <CardContent className="p-4">
              <div className="text-sm font-semibold">{recipe.title}</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {recipe.description}
              </p>
              <ol className="mt-4 space-y-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {recipe.steps.map((step, index) => (
                  <li key={step} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                    <span className="text-xs tabular-nums text-neutral-500">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {recipe.relatedSlug ? (
                <Button variant="ghost" size="sm" asChild className="mt-4 px-0">
                  <Link href={componentHref(recipe.relatedSlug)} prefetch={false}>
                    {recipe.relatedLabel ?? 'Open related pattern'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </DocsSection>
  )
}

function SdkReadsSection({ reads }: { reads: ComponentSdkRead[] }) {
  return (
    <DocsSection title="SDK Reads">
      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="hidden grid-cols-[1.15fr_1fr_1fr_1.05fr] border-b border-neutral-200 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 dark:border-neutral-800 md:grid">
          <div className="px-4 py-3">Raw read</div>
          <div className="border-l border-neutral-200 px-4 py-3 dark:border-neutral-800">
            Adapter
          </div>
          <div className="border-l border-neutral-200 px-4 py-3 dark:border-neutral-800">
            UI props
          </div>
          <div className="border-l border-neutral-200 px-4 py-3 dark:border-neutral-800">
            Parent owns
          </div>
        </div>
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {reads.map((read) => (
            <div
              key={`${read.rawRead}-${read.adapter}`}
              className="grid gap-0 text-sm md:grid-cols-[1.15fr_1fr_1fr_1.05fr]"
            >
              <SdkReadCell label="Raw read">{read.rawRead}</SdkReadCell>
              <SdkReadCell label="Adapter">{read.adapter}</SdkReadCell>
              <SdkReadCell label="UI props">{read.produces}</SdkReadCell>
              <SdkReadCell label="Parent owns">{read.parentOwns}</SdkReadCell>
            </div>
          ))}
        </div>
      </div>
    </DocsSection>
  )
}

function SdkReadCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-neutral-200 px-4 py-3 dark:border-neutral-800 md:border-l md:first:border-l-0">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 md:hidden">
        {label}
      </div>
      <p className="break-words leading-6 text-neutral-600 dark:text-neutral-400">{children}</p>
    </div>
  )
}

function BuilderPathNav({ entry }: { entry: ComponentEntry }) {
  const placement = getBuilderPathStep(entry.slug)
  if (!placement) return null

  return (
    <nav
      aria-label="HIP-4 builder path navigation"
      className="border-t border-neutral-200 pt-5 dark:border-neutral-800"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            HIP-4 Builder Path
          </div>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            <span className="tabular-nums">Step {placement.index + 1}</span> of{' '}
            <span className="tabular-nums">{placement.total}</span>: {placement.step.title}.{' '}
            {placement.step.boundary}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {placement.previous ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={componentHref(placement.previous.slug)} prefetch={false}>
                <ArrowLeft className="h-3.5 w-3.5" />
                {placement.previous.title}
              </Link>
            </Button>
          ) : null}
          {placement.next ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={componentHref(placement.next.slug)} prefetch={false}>
                {placement.next.title}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </nav>
  )
}

async function writeClipboardText(code: string) {
  if (copyTextWithTextarea(code)) return true

  try {
    await navigator.clipboard.writeText(code)
    return true
  } catch {
    return false
  }
}

function copyTextWithTextarea(code: string) {
  const textarea = document.createElement('textarea')
  textarea.value = code
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

function PatternApiSection({ entry }: { entry: ComponentEntry }) {
  const contract = getComponentContract(entry.slug)
  if (contract.props.length === 0 && contract.states.length === 0) return null

  return (
    <DocsSection title="Props Reference">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <div className="text-sm font-semibold">Props</div>
            </div>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {contract.props.map((prop) => (
                <div
                  key={prop.name}
                  className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[140px_minmax(0,1fr)]"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {prop.name}
                      {prop.required ? <span className="text-neutral-500"> *</span> : null}
                    </div>
                    <div className="mt-1 break-words font-mono text-xs text-neutral-500">
                      {prop.type}
                    </div>
                  </div>
                  <p className="leading-6 text-neutral-600 dark:text-neutral-400">
                    {prop.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-semibold">States</div>
              <div className="mt-3 space-y-3">
                {contract.states.map((state) => (
                  <div key={state.name}>
                    <div className="text-sm font-medium">{state.name}</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                      {state.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-semibold">Accessibility</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {contract.accessibility}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DocsSection>
  )
}

function CopyGuideSection({ entry }: { entry: ComponentEntry }) {
  const integration = getComponentIntegration(entry.slug)

  return (
    <DocsSection title="Copy Contract">
      <BoundarySummary entry={entry} />
      {integration.copyContract ? <CopyMap contract={integration.copyContract} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <IntegrationList title="Data" items={integration.data} />
        <IntegrationList title="Parent owns" items={integration.parentOwns} />
        <IntegrationList title="Checks" items={integration.productionChecks} />
      </div>
    </DocsSection>
  )
}

function BoundarySummary({ entry }: { entry: ComponentEntry }) {
  const rows = [
    ['Used for', entry.useCase.usedFor],
    ['Reads', entry.useCase.reads],
    ['Does not', entry.useCase.doesNot],
  ] as const

  return (
    <div className="grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 md:grid-cols-3">
      {rows.map(([label, value]) => (
        <UseCaseRow key={label} label={label} value={value} />
      ))}
    </div>
  )
}

function CopyMap({ contract }: { contract: ComponentCopyContract }) {
  const rows = [
    ['Adapter', contract.adapter],
    ['Pattern', contract.pattern],
    ['Parent owns', contract.parentOwns],
  ] as const

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-sm font-semibold">Implementation map</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              {label}
            </div>
            <p className="mt-1 break-words text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function IntegrationList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function UseCaseRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </div>
      <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{value}</p>
    </div>
  )
}

function installCommand(entry: ComponentEntry) {
  if (entry.slug === 'usdh-widget') return 'pnpm add @usdh-kit/widget wagmi viem'
  return 'pnpm add @usdh-kit/sdk'
}
