'use client'

import { ArrowRight, Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import {
  type ComponentEntry,
  componentHref,
  visibleComponentEntries,
} from '../lib/component-registry'

const categories = ['All', 'Widget'] as const
type CategoryFilter = (typeof categories)[number]

export function ComponentRegistryExperience() {
  const [category, setCategory] = useState<CategoryFilter>('All')
  const [query, setQuery] = useState('')

  const filteredEntries = useMemo(
    () =>
      visibleComponentEntries.filter((entry) => {
        const categoryMatch = category === 'All' || entry.category === category
        const queryValue = query.trim().toLowerCase()
        if (!queryValue) return categoryMatch
        const text = [
          entry.title,
          entry.shortTitle,
          entry.description,
          entry.category,
          ...entry.tags,
        ]
          .join(' ')
          .toLowerCase()
        return categoryMatch && text.includes(queryValue)
      }),
    [category, query],
  )

  return (
    <div className="registry-fade-up mx-auto w-full max-w-[calc(100vw-2rem)] space-y-6 overflow-hidden sm:max-w-full xl:max-w-[1040px]">
      <header className="space-y-4">
        <div className="max-w-[680px]">
          <h1 className="max-w-[19rem] break-words text-2xl font-semibold tracking-normal text-neutral-950 text-balance dark:text-neutral-50 sm:max-w-[720px] sm:text-3xl">
            USDH sunset migration kit.
          </h1>
          <p className="mt-3 max-w-[21rem] break-words text-sm leading-6 text-neutral-600 dark:text-neutral-400 sm:max-w-2xl">
            A migration widget for remaining USDH balances, with the legacy swap kept only for
            compatibility.
          </p>
        </div>
      </header>

      <div className="flex max-w-full flex-col gap-3 border-y border-neutral-200 py-4 dark:border-neutral-800 lg:flex-row lg:items-center">
        <div className="relative lg:w-[320px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter components"
            aria-label="Filter components"
          />
        </div>
        <div className="min-w-0 flex-1">
          <ToggleGroup
            type="single"
            value={category}
            className="grid w-full grid-cols-2 justify-stretch gap-1 border-0 bg-transparent p-0 sm:flex sm:flex-wrap sm:justify-start"
            onValueChange={(value) => {
              if (value) setCategory(value as CategoryFilter)
            }}
            aria-label="Filter by category"
          >
            {categories.map((item) => (
              <ToggleGroupItem
                key={item}
                value={item}
                className="w-full whitespace-nowrap sm:w-auto"
              >
                {item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <section className="max-w-full">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredEntries.map((entry) => (
            <ComponentCard key={entry.slug} entry={entry} />
          ))}
        </div>

        {filteredEntries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-sm text-neutral-500">
              No components match this filter.
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  )
}

function ComponentCard({ entry }: { entry: ComponentEntry }) {
  return (
    <Card className="group overflow-hidden transition-colors duration-150 hover:border-neutral-300 dark:hover:border-neutral-700">
      <Link
        href={componentHref(entry.slug)}
        prefetch={false}
        className="block w-full p-3.5 text-left"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
            <entry.icon className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-300" />
          </span>
        </div>
        <CardTitle className="mt-3 text-base">{entry.title}</CardTitle>
        <CardDescription className="mt-2 max-w-[18rem] break-words line-clamp-3 leading-6 sm:max-w-none">
          {entry.description}
        </CardDescription>
      </Link>
      <Separator />
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <span className="text-xs font-medium text-neutral-500">{entry.category}</span>
        <Link
          href={componentHref(entry.slug)}
          prefetch={false}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  )
}
