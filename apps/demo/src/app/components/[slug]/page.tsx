import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ComponentDetailExperience } from '../../../components/ComponentDetailExperience'
import { ComponentDocsShell } from '../../../components/ComponentDocsShell'
import {
  componentEntries,
  getComponentEntry,
  parseRegistryDataMode,
} from '../../../lib/component-registry'
import { loadGallerySnapshot } from '../../../lib/gallery-data'

export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const entry = getComponentEntry(slug)
    if (!entry) return { title: 'Component not found - usdh-kit' }
    return {
      title: `${entry.title} - usdh-kit components`,
      description: entry.description,
    }
  })
}

export function generateStaticParams() {
  return componentEntries.map((entry) => ({ slug: entry.slug }))
}

export default async function ComponentDetailPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams?: SearchParams
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const entry = getComponentEntry(slug)
  if (!entry) notFound()

  const dataMode = parseRegistryDataMode(query?.data)
  const effectiveDataMode = entry.liveCapable ? dataMode : 'sample'
  const bookCoin = typeof query?.coin === 'string' ? query.coin : undefined
  const snapshot = await loadGallerySnapshot({
    mode: effectiveDataMode,
    bookCoin,
  })

  return (
    <ComponentDocsShell activeSlug={entry.slug}>
      <ComponentDetailExperience
        slug={entry.slug}
        dataMode={effectiveDataMode}
        snapshot={snapshot}
      />
    </ComponentDocsShell>
  )
}
