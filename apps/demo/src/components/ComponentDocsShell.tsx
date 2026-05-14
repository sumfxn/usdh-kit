'use client'

import { Box, ExternalLink, Menu, Search } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import {
  type ComponentSlug,
  componentEntries,
  componentHref,
  componentSections,
} from '../lib/component-registry'

interface ComponentDocsShellProps {
  activeSlug?: ComponentSlug
  children: ReactNode
}

export function ComponentDocsShell({ activeSlug, children }: ComponentDocsShellProps) {
  const [navQuery, setNavQuery] = useState('')

  return (
    <main className="min-h-screen overflow-x-hidden bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <RegistryMotionStyles />
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="flex h-14 w-full box-border items-center gap-3 px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open component navigation">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[calc(100vw-1rem)] max-w-80">
                <SheetHeader>
                  <SheetTitle>Components</SheetTitle>
                  <SheetDescription>USDH surfaces for builder apps.</SheetDescription>
                </SheetHeader>
                <Separator />
                <div className="px-3 py-4">
                  <SidebarSearch value={navQuery} onChange={setNavQuery} />
                </div>
                <ScrollArea className="h-[calc(100vh-12rem)] px-3">
                  <SidebarNav activeSlug={activeSlug} query={navQuery} showIndex />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>

          <Link
            href="/"
            prefetch={false}
            className="flex min-w-0 items-center gap-2 text-sm font-semibold"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md border border-neutral-200 bg-neutral-950 text-[11px] font-semibold text-white dark:border-neutral-800 dark:bg-white dark:text-neutral-950">
              u
            </span>
            <span className="truncate">usdh-kit</span>
          </Link>

          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />

          <nav className="hidden items-center gap-1 text-sm md:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/components" prefetch={false}>
                Components
              </Link>
            </Button>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <a href="https://github.com/sumfxn/usdh-kit" target="_blank" rel="noreferrer">
                GitHub
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid w-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="hidden border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:block">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)]">
            <div className="space-y-4 px-6 py-5">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Box className="h-4 w-4" />
                  Registry
                </div>
                <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                  Copyable USDH product patterns.
                </p>
              </div>
              <SidebarSearch value={navQuery} onChange={setNavQuery} />
            </div>
            <Separator />
            <ScrollArea className="h-[calc(100vh-13.5rem)] px-5 py-4">
              <SidebarNav activeSlug={activeSlug} query={navQuery} showIndex />
            </ScrollArea>
          </div>
        </aside>

        <section className="min-w-0 w-full max-w-full box-border overflow-x-hidden px-4 py-7 sm:px-6 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto min-w-0 w-full max-w-[1120px]">{children}</div>
        </section>
      </div>
    </main>
  )
}

function SidebarSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <Input
        className="h-9 pl-8 text-sm"
        placeholder="Search components"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function SidebarNav({
  activeSlug,
  query,
  showIndex,
}: {
  activeSlug?: ComponentSlug
  query: string
  showIndex?: boolean
}) {
  const normalizedQuery = query.trim().toLowerCase()
  const visibleSections = useMemo(
    () =>
      componentSections
        .map((section) => ({
          ...section,
          items: section.items.filter((slug) => {
            const entry = componentEntries.find((item) => item.slug === slug)
            if (!entry || !normalizedQuery) return true
            return [entry.title, entry.shortTitle, entry.category, entry.description, ...entry.tags]
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          }),
        }))
        .filter((section) => section.items.length > 0),
    [normalizedQuery],
  )

  return (
    <nav className="space-y-6 pb-8 text-sm">
      {showIndex ? (
        <div className="space-y-1">
          <NavLink href="/components" active={!activeSlug}>
            Overview
          </NavLink>
        </div>
      ) : null}
      {visibleSections.map((section) => (
        <div key={section.title}>
          <div className="mb-2 px-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {section.title}
          </div>
          <div className="space-y-1">
            {section.items.map((slug) => {
              const entry = componentEntries.find((item) => item.slug === slug)
              if (!entry) return null
              return (
                <NavLink key={slug} href={componentHref(slug)} active={activeSlug === slug}>
                  <span className="flex min-w-0 items-center gap-2">
                    <entry.icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <span className="truncate">{entry.shortTitle}</span>
                  </span>
                </NavLink>
              )
            })}
          </div>
        </div>
      ))}
      {visibleSections.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-200 px-3 py-4 text-sm text-neutral-500 dark:border-neutral-800">
          No matches.
        </div>
      ) : null}
    </nav>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        'group flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150',
        active
          ? 'border border-neutral-200 bg-neutral-100/65 font-medium text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-50'
          : 'text-neutral-600 hover:bg-neutral-100/60 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900/45 dark:hover:text-neutral-50',
      )}
    >
      {children}
    </Link>
  )
}

function RegistryMotionStyles() {
  return (
    <style>{`
      @keyframes registry-fade-up {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .registry-fade-up { animation: registry-fade-up 220ms ease-out both; }
      @media (prefers-reduced-motion: reduce) {
        .registry-fade-up { animation: none !important; }
        * { scroll-behavior: auto !important; transition-duration: 0ms !important; }
      }
    `}</style>
  )
}
