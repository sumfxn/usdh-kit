import { createRequire } from 'node:module'

import widgetContent from '@usdh-kit/widget/tailwind-content'
import type { Config } from 'tailwindcss'

const require = createRequire(import.meta.url)
const widgetTailwindConfig = require('../../packages/widget/tailwind.config.cjs')
const widgetColors = widgetTailwindConfig.theme?.extend?.colors ?? {}

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/widget/src/**/*.{ts,tsx}', ...widgetContent],
  theme: {
    extend: {
      colors: widgetColors,
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
