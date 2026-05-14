import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface PackageJson {
  exports?: {
    '.'?: {
      types?: string
      import?: string
      require?: string
    }
    './styles.css'?: string
    './tailwind-content'?: {
      types?: string
      default?: string
    }
  }
  types?: string
  main?: string
  module?: string
}

describe('package exports', () => {
  it('exposes an ESM widget root and CJS-safe secondary entries', () => {
    const packageJson = readPackageJson()
    const rootExport = packageJson.exports?.['.']

    expect(packageJson.types).toBe('./dist/index.d.ts')
    expect(packageJson.main).toBeUndefined()
    expect(packageJson.module).toBe('./dist/index.js')
    expect(rootExport).toEqual({
      types: './dist/index.d.ts',
      import: './dist/index.js',
    })
    expect(rootExport?.require).toBeUndefined()
    expect(packageJson.exports?.['./styles.css']).toBe('./dist/styles.css')
    expect(packageJson.exports?.['./tailwind-content']).toEqual({
      types: './tailwind-content.d.cts',
      default: './tailwind-content.cjs',
    })
  })
})

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as PackageJson
}
