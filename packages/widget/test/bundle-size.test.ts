import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Bundle size budget for the widget.
 *
 * We gate on the raw ESM size (uncompressed) because that is what npm
 * publishes and what Bundlephobia displays in the README badge. Real
 * over-the-wire size to end users is gzipped and roughly 30 to 35 % of
 * this number.
 *
 * Current actual: ~56.6 KB ESM after the browser agent-session flow, native
 * USDC bridge support, and dual-token balance display. Budget leaves a small
 * cushion while still catching dependency creep; viem/accounts remains
 * external and is not bundled into the widget.
 */
const BUDGET_KB = 58

describe('widget bundle size', () => {
  it('ESM bundle stays under budget', () => {
    const distPath = resolve(__dirname, '../dist/index.js')
    if (!existsSync(distPath)) {
      throw new Error(
        `dist/index.js missing at ${distPath} -- run \`pnpm --filter @usdh-kit/widget build\` before \`pnpm test\``,
      )
    }
    const sizeBytes = statSync(distPath).size
    const sizeKb = sizeBytes / 1024
    expect(sizeKb).toBeLessThan(BUDGET_KB)
  })
})
