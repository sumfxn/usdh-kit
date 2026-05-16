'use client'

import { USDHMigration } from '@usdh-kit/widget'

export function SwapSection() {
  return (
    <section className="flex justify-center">
      <USDHMigration network="mainnet" />
    </section>
  )
}
