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
 * Current actual: ~38 KB ESM. Budget set 30 % above to leave room for
 * V1.5 features (reverse direction, multi-chain source) without forcing
 * a knee-jerk widget refactor. Tighten this if the bundle bloats from
 * dependency creep rather than feature work.
 */
const BUDGET_KB = 50

describe('widget bundle size', () => {
  it('ESM bundle stays under budget', () => {
    const distPath = resolve(__dirname, '../dist/index.js')
    if (!existsSync(distPath)) {
      throw new Error(
        `dist/index.js missing at ${distPath} — run \`pnpm --filter @usdh-kit/widget build\` before \`pnpm test\``,
      )
    }
    const sizeBytes = statSync(distPath).size
    const sizeKb = sizeBytes / 1024
    expect(sizeKb).toBeLessThan(BUDGET_KB)
  })
})
