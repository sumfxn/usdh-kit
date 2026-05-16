import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const demoDir = join(repoRoot, 'apps', 'demo')
const routes = [
  '/components',
  '/components/usdh-migration',
  '/components/usdh-widget',
  '/components/market-board',
  '/components/outcome-reads',
  '/components/outcome-market-row',
  '/components/outcome-odds-selector',
  '/components/outcome-order-book',
  '/components/outcome-position-row',
  '/components/order-ticket-mock',
]
const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
]
const criticalConsoleTypes = new Set(['error'])
const forbiddenVisiblePhrases = ['sample fallback', 'live read-only', 'mocked preview data']

const externalBaseUrl = process.env.USDH_DEMO_BASE_URL
const port = process.env.USDH_DEMO_QA_PORT ?? '43157'
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`
let server

try {
  if (!externalBaseUrl) {
    assertBuiltDemo()
    server = startDemoServer(port)
    await waitForServer(baseUrl)
  }

  await runBrowserSmoke(baseUrl)
  process.stdout.write(`demo browser smoke passed at ${baseUrl}\n`)
} finally {
  if (server) await stopServer(server)
}

function assertBuiltDemo() {
  const buildId = join(demoDir, '.next', 'BUILD_ID')
  if (!existsSync(buildId)) {
    throw new Error(`Missing ${relative(repoRoot, buildId)}. Run the demo build before qa:demo.`)
  }
}

function startDemoServer(serverPort) {
  const child = spawn(
    pnpmCommand(),
    ['--filter', '@usdh-kit-apps/demo', 'exec', 'next', 'start', '-p', serverPort],
    {
      cwd: repoRoot,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    },
  )
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.output = ''
  child.stdout.on('data', (chunk) => {
    child.output += chunk
  })
  child.stderr.on('data', (chunk) => {
    child.output += chunk
  })
  return child
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000
  let lastError
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) {
      throw new Error(`Demo server exited early.\n${server.output}`)
    }
    try {
      const response = await fetch(`${url}/components`, { method: 'HEAD' })
      if (response.ok) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await sleep(250)
  }
  throw new Error(`Demo server did not become ready: ${lastError?.message ?? 'unknown error'}`)
}

async function runBrowserSmoke(url) {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: 'dark',
      })
      const page = await context.newPage()
      const browserErrors = collectBrowserErrors(page, url)
      try {
        for (const route of routes) {
          await checkRoute(page, browserErrors, url, route, viewport)
        }
        await checkCopyButton(page, browserErrors, url, viewport)
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
}

function collectBrowserErrors(page, url) {
  const errors = []
  page.on('console', (message) => {
    if (criticalConsoleTypes.has(message.type())) {
      errors.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    errors.push(`page error: ${error.message}`)
  })
  page.on('response', (response) => {
    const responseUrl = response.url()
    if (!responseUrl.startsWith(url) && !responseUrl.includes('/_next/')) return
    if (response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${responseUrl}`)
    }
  })
  return errors
}

async function checkRoute(page, browserErrors, url, route, viewport) {
  const response = await page.goto(`${url}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  if (!response?.ok()) {
    throw new Error(`${viewport.name} ${route} returned HTTP ${response?.status() ?? 'unknown'}`)
  }

  await page.locator('main').waitFor({ timeout: 10_000 })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)

  await assertCssLoaded(page, route, viewport)
  await assertNoHorizontalOverflow(page, route, viewport)
  await assertVisibleContent(page, route, viewport)
  assertNoBrowserErrors(browserErrors, route, viewport)
}

async function assertCssLoaded(page, route, viewport) {
  const css = await page.evaluate(() => {
    const body = window.getComputedStyle(document.body)
    const overviewCard = [
      ...document.querySelectorAll('main a[href="/components/usdh-widget"]'),
    ].find((candidate) => candidate.querySelector('h3'))
    const overviewStyle = overviewCard ? window.getComputedStyle(overviewCard) : null
    return {
      background: body.backgroundColor,
      styleSheets: document.styleSheets.length,
      overviewDisplay: overviewStyle?.display ?? null,
      overviewBorderWidth: overviewStyle?.borderTopWidth ?? null,
      overviewRadius: overviewStyle?.borderTopLeftRadius ?? null,
    }
  })

  if (css.styleSheets === 0) {
    throw new Error(`${viewport.name} ${route} loaded without stylesheets`)
  }
  if (css.background === 'rgba(0, 0, 0, 0)') {
    throw new Error(`${viewport.name} ${route} body background suggests CSS did not load`)
  }
  if (route === '/components' && css.overviewDisplay !== 'block') {
    throw new Error(`${viewport.name} ${route} overview card is unstyled: ${JSON.stringify(css)}`)
  }
}

async function assertNoHorizontalOverflow(page, route, viewport) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
  const maxScrollWidth = Math.max(overflow.scrollWidth, overflow.bodyScrollWidth)
  if (maxScrollWidth > overflow.clientWidth + 2) {
    throw new Error(
      `${viewport.name} ${route} has horizontal overflow: ${maxScrollWidth}px > ${overflow.clientWidth}px`,
    )
  }
}

async function assertVisibleContent(page, route, viewport) {
  const h1Count = await page.locator('h1').count()
  if (h1Count < 1) {
    throw new Error(`${viewport.name} ${route} rendered without an h1`)
  }

  const visibleText = (await page.locator('main').innerText()).toLowerCase()
  for (const phrase of forbiddenVisiblePhrases) {
    if (visibleText.includes(phrase)) {
      throw new Error(`${viewport.name} ${route} exposes debug phrase: ${phrase}`)
    }
  }
}

async function checkCopyButton(page, browserErrors, url, viewport) {
  const route = '/components/outcome-reads'
  await page.goto(`${url}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.locator('main').waitFor({ timeout: 10_000 })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)

  const copyButtons = page.getByRole('button', { name: 'Copy' })
  const count = await copyButtons.count()
  if (count < 1) {
    throw new Error(`${viewport.name} ${route} rendered without copy buttons`)
  }
  await copyButtons.first().click()
  await page.getByRole('button', { name: 'Copied' }).first().waitFor({ timeout: 2_500 })
  assertNoBrowserErrors(browserErrors, route, viewport)
}

function assertNoBrowserErrors(browserErrors, route, viewport) {
  if (browserErrors.length === 0) return
  const details = browserErrors.splice(0).join('\n')
  throw new Error(`${viewport.name} ${route} emitted browser errors:\n${details}`)
}

async function stopServer(child) {
  if (child.exitCode !== null) return
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
  await Promise.race([onceExit(child), sleep(2_000)])
  child.stdout.destroy()
  child.stderr.destroy()
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function onceExit(child) {
  return new Promise((resolveExit) => {
    if (child.exitCode !== null) {
      resolveExit()
      return
    }
    child.once('exit', resolveExit)
  })
}
