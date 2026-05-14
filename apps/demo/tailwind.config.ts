import { createRequire } from 'node:module'

import widgetContent from '@usdh-kit/widget/tailwind-content'
import type { Config } from 'tailwindcss'

const require = createRequire(import.meta.url)
const widgetTailwindConfig = require('../../packages/widget/tailwind.config.cjs') as Config
const widgetTheme = widgetTailwindConfig.theme as
  | {
      extend?: {
        colors?: Record<string, string>
      }
    }
  | undefined

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/widget/src/**/*.{ts,tsx}', ...widgetContent],
  theme: {
    extend: {
      colors: widgetTheme?.extend?.colors,
      fontFamily: {
        sans: [
          'var(--font-geist-sans)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
