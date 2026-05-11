import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

const demoDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(demoDir, '../..')

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingRoot: repoRoot,
  webpack: (webpackConfig) => {
    webpackConfig.resolve ??= {}
    webpackConfig.resolve.extensionAlias = {
      ...(webpackConfig.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    }
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias ?? {}),
      '@usdh-kit/sdk$': resolve(repoRoot, 'packages/sdk/src/index.ts'),
      '@usdh-kit/widget$': resolve(repoRoot, 'packages/widget/src/index.ts'),
      '@usdh-kit/widget/styles.css$': resolve(repoRoot, 'packages/widget/src/styles.css'),
      'pino-pretty': false,
    }
    return webpackConfig
  },
}

export default config
