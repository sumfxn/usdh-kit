import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tempRoot = await mkdtemp(join(tmpdir(), 'usdh-kit-consumer-'))
const packageArchiveDir = join(tempRoot, 'packed')
const keepTemp = process.env.USDH_KEEP_CONSUMER_SMOKE === '1'

const expectedPublishedFiles = {
  '@usdh-kit/sdk': ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'README.md', 'LICENSE'],
  '@usdh-kit/widget': [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/styles.css',
    'tailwind-content.cjs',
    'tailwind-content.d.cts',
    'README.md',
    'LICENSE',
  ],
}

try {
  await assertBuiltPackage('packages/sdk', ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts'])
  await assertBuiltPackage('packages/widget', [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/styles.css',
    'tailwind-content.cjs',
    'tailwind-content.d.cts',
  ])

  const packedPackages = {
    sdk: await packPackage('packages/sdk'),
    widget: await packPackage('packages/widget'),
  }
  await writeConsumerProject(packedPackages)
  runNode('esm-consumer.mjs')
  runNode('cjs-consumer.cjs')
  runTsc()

  process.stdout.write(`consumer smoke passed in ${relative(repoRoot, tempRoot)}\n`)
} finally {
  if (keepTemp) {
    process.stdout.write(`kept consumer smoke fixture at ${tempRoot}\n`)
  } else {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function assertBuiltPackage(packageDir, files) {
  for (const file of files) {
    const path = join(repoRoot, packageDir, file)
    if (!existsSync(path)) {
      throw new Error(
        `Missing ${relative(repoRoot, path)}. Run package builds before consumer smoke.`,
      )
    }
  }
}

async function packPackage(packageDir) {
  await mkdir(packageArchiveDir, { recursive: true })
  const before = new Set(await readdir(packageArchiveDir))
  run(pnpmCommand(), ['pack', '--pack-destination', packageArchiveDir], {
    cwd: join(repoRoot, packageDir),
  })

  const after = await readdir(packageArchiveDir)
  const packed = after.filter((file) => file.endsWith('.tgz') && !before.has(file))
  if (packed.length !== 1) {
    throw new Error(
      `Expected exactly one tarball for ${packageDir}, found ${packed.length}: ${packed.join(', ')}`,
    )
  }
  return join(packageArchiveDir, packed[0])
}

async function writeConsumerProject(packedPackages) {
  await mkdir(join(tempRoot, 'node_modules', '@usdh-kit'), { recursive: true })
  await installPackedPackage('@usdh-kit/sdk', packedPackages.sdk)
  await installPackedPackage('@usdh-kit/widget', packedPackages.widget)

  for (const dependency of [
    'react',
    'react-dom',
    '@types/react',
    '@types/react-dom',
    '@tanstack/react-query',
    '@noble/hashes',
    'viem',
    'wagmi',
  ]) {
    await linkWorkspaceDependency(dependency)
  }

  await writeFile(
    join(tempRoot, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: {
          '@usdh-kit/sdk': `file:${relative(tempRoot, packedPackages.sdk).replaceAll('\\', '/')}`,
          '@usdh-kit/widget': `file:${relative(tempRoot, packedPackages.widget).replaceAll(
            '\\',
            '/',
          )}`,
        },
        devDependencies: {
          typescript: 'workspace:*',
        },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(join(tempRoot, 'esm-consumer.mjs'), esmConsumerSource())
  await writeFile(join(tempRoot, 'cjs-consumer.cjs'), cjsConsumerSource())
  await writeFile(join(tempRoot, 'consumer.ts'), tsConsumerSource())
  await writeFile(
    join(tempRoot, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          jsx: 'react-jsx',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        },
        include: ['consumer.ts'],
      },
      null,
      2,
    )}\n`,
  )
}

async function installPackedPackage(name, tarballPath) {
  const linkPath = join(tempRoot, 'node_modules', ...name.split('/'))
  const extractRoot = join(tempRoot, 'extracted', name.replace('/', '__'))
  await mkdir(dirname(linkPath), { recursive: true })
  await mkdir(extractRoot, { recursive: true })

  run('tar', ['-xzf', tarballPath, '-C', extractRoot])

  const extractedPackageDir = join(extractRoot, 'package')
  if (!existsSync(extractedPackageDir)) {
    throw new Error(`Packed ${name} did not extract to a package directory`)
  }

  await cp(extractedPackageDir, linkPath, { recursive: true })
  await assertPublishedFiles(name, linkPath)
  await assertNoWorkspaceProtocol(name, join(linkPath, 'package.json'))
}

async function assertPublishedFiles(name, packageDir) {
  const expectedFiles = expectedPublishedFiles[name]
  if (expectedFiles === undefined) return

  for (const file of expectedFiles) {
    const filePath = join(packageDir, file)
    if (!existsSync(filePath)) {
      throw new Error(`${name} tarball is missing ${file}`)
    }
  }

  for (const unpublishedDir of ['src', 'test']) {
    const dirPath = join(packageDir, unpublishedDir)
    if (existsSync(dirPath)) {
      throw new Error(`${name} tarball unexpectedly includes ${unpublishedDir}/`)
    }
  }
}

async function assertNoWorkspaceProtocol(name, packageJsonPath) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  const publishDependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies']
  for (const field of publishDependencyFields) {
    const dependencies = packageJson[field]
    if (!dependencies || typeof dependencies !== 'object') continue
    for (const [dependencyName, version] of Object.entries(dependencies)) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        throw new Error(`${name} packed ${field}.${dependencyName} still uses ${version}`)
      }
    }
  }
}

async function linkPackage(name, target) {
  const linkPath = join(tempRoot, 'node_modules', ...name.split('/'))
  await mkdir(dirname(linkPath), { recursive: true })
  await symlink(target, linkPath, symlinkType())
}

async function linkWorkspaceDependency(name) {
  const target = resolveWorkspaceDependency(name)
  if (!existsSync(target)) return
  await linkPackage(name, target)
}

function resolveWorkspaceDependency(name) {
  const segments = name.split('/')
  const candidateRoots = [
    repoRoot,
    join(repoRoot, 'packages', 'sdk'),
    join(repoRoot, 'packages', 'widget'),
    join(repoRoot, 'apps', 'demo'),
  ]

  for (const candidateRoot of candidateRoots) {
    const target = join(candidateRoot, 'node_modules', ...segments)
    if (existsSync(target)) return target
  }

  return join(repoRoot, 'node_modules', ...segments)
}

function runNode(file) {
  run(process.execPath, [join(tempRoot, file)])
}

function runTsc() {
  const tscBin = join(
    repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
  )
  run(tscBin, ['-p', join(tempRoot, 'tsconfig.json')])
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? tempRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
  })
  if (result.status !== 0) {
    const failure = result.error ? `: ${result.error.message}` : ''
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${failure}`)
  }
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

function symlinkType() {
  return process.platform === 'win32' ? 'junction' : 'dir'
}

function esmConsumerSource() {
  return `import { createRequire } from 'node:module'
import {
  createUsdhKit,
  listUsdhSpotPairs,
  normalizeOutcomeMeta,
  outcomeCoin,
} from '@usdh-kit/sdk'
import { USDHSwap, friendlyError } from '@usdh-kit/widget'

const require = createRequire(import.meta.url)
const cssPath = require.resolve('@usdh-kit/widget/styles.css')
const tailwindContent = require('@usdh-kit/widget/tailwind-content')

if (typeof createUsdhKit !== 'function') throw new Error('SDK ESM kit export failed')

const pairs = listUsdhSpotPairs({
  tokens: [
    { name: 'USDC', szDecimals: 6, weiDecimals: 8, index: 0, tokenId: '0x0', isCanonical: true, evmContract: null, fullName: null },
    { name: 'USDH', szDecimals: 6, weiDecimals: 8, index: 150, tokenId: '0x1', isCanonical: false, evmContract: null, fullName: null },
  ],
  universe: [{ name: '@230', tokens: [150, 0], index: 230, isCanonical: false }],
})
if (pairs[0]?.base !== 'USDH') throw new Error('SDK ESM discovery export failed')

const [market] = normalizeOutcomeMeta({
  outcomes: [
    {
      outcome: 20,
      name: 'USDH weekly volume clears $5m',
      description: 'class:volume|asset:USDH|target:5000000',
      sideSpecs: [{ name: 'Yes' }, { name: 'No' }],
    },
  ],
})
if (!market) throw new Error('SDK ESM outcome metadata failed')
if (outcomeCoin(market.outcome, 0) !== '#200') throw new Error('SDK ESM outcome helper failed')
if (typeof USDHSwap !== 'function') throw new Error('Widget ESM export failed')
if (friendlyError(new Error('boom')) !== 'boom') throw new Error('Widget helper export failed')
if (!cssPath.replaceAll('\\\\', '/').endsWith('/dist/styles.css')) {
  throw new Error('Widget CSS export failed')
}
if (!Array.isArray(tailwindContent) || tailwindContent.length === 0) {
  throw new Error('Widget tailwind-content export failed')
}
`
}

function cjsConsumerSource() {
  return `const sdk = require('@usdh-kit/sdk')
const widgetCss = require.resolve('@usdh-kit/widget/styles.css')
const widgetContent = require('@usdh-kit/widget/tailwind-content')

if (typeof sdk.createUsdhKit !== 'function') throw new Error('SDK CJS export failed')
try {
  require('@usdh-kit/widget')
  throw new Error('Widget root unexpectedly allowed CommonJS require')
} catch (error) {
  if (
    error?.message === 'Widget root unexpectedly allowed CommonJS require' ||
    error?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED'
  ) {
    throw error
  }
}
if (!widgetCss.replaceAll('\\\\', '/').endsWith('/dist/styles.css')) {
  throw new Error('Widget CSS CJS resolve failed')
}
if (!Array.isArray(widgetContent) || widgetContent.length === 0) {
  throw new Error('Widget tailwind-content CJS export failed')
}
`
}

function tsConsumerSource() {
  return `import {
  createUsdhKit,
  normalizeOutcomeMeta,
  outcomeCoin,
  type L2Book,
} from '@usdh-kit/sdk'
import { USDHSwap, type USDHSwapProps, type WidgetTheme } from '@usdh-kit/widget'
import widgetContent = require('@usdh-kit/widget/tailwind-content')

const book: L2Book = {
  coin: '@230',
  time: 1778427457824,
  levels: [
    [{ px: '0.9999', sz: '17000', n: 1 }],
    [{ px: '1.0001', sz: '14000', n: 1 }],
  ],
}

const kitFactory: typeof createUsdhKit = createUsdhKit
const [market] = normalizeOutcomeMeta({
  outcomes: [
    {
      outcome: 20,
      name: 'USDH weekly volume clears $5m',
      description: 'class:volume|asset:USDH|target:5000000',
      sideSpecs: [{ name: 'Yes' }, { name: 'No' }],
    },
  ],
})
const coin = market ? outcomeCoin(market.outcome, 0) : '#0'
const theme: WidgetTheme = 'dark'
const props: USDHSwapProps = { network: 'mainnet', theme }
const Widget = USDHSwap
const content: string[] = widgetContent

void book
void kitFactory
void coin
void props
void Widget
void content
`
}
