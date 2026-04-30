'use client'

import { USDHSwap } from '@usdh-kit/widget'

export function SwapSection() {
  return (
    <section className="flex justify-center">
      <USDHSwap network="mainnet" />
    </section>
  )
}
