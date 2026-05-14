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
  }
  types?: string
  main?: string
  module?: string
}

describe('package exports', () => {
  it('exposes root types for TypeScript bundler consumers', () => {
    const packageJson = readPackageJson()
    const rootExport = packageJson.exports?.['.']

    expect(packageJson.types).toBe('./dist/index.d.ts')
    expect(packageJson.main).toBe('./dist/index.cjs')
    expect(packageJson.module).toBe('./dist/index.js')
    expect(rootExport).toEqual({
      types: './dist/index.d.ts',
      import: './dist/index.js',
      require: './dist/index.cjs',
    })
  })
})

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as PackageJson
}
