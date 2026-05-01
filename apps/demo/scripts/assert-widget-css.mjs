import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const cssDir = join(process.cwd(), '.next', 'static', 'css')

function cssFiles(dir) {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return cssFiles(path)
    }
    return entry.isFile() && entry.name.endsWith('.css') ? [path] : []
  })
}

const css = cssFiles(cssDir)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

const hasWidgetRoot = css.includes('.usdh-widget')
const hasWidgetUtilities = /\.border-usdh-[^{]+\{|\.bg-usdh-[^{]+\{/.test(css)

if (!hasWidgetRoot || !hasWidgetUtilities) {
  console.error('Demo build is missing @usdh-kit/widget CSS.')
  console.error(`- .usdh-widget tokens: ${hasWidgetRoot ? 'found' : 'missing'}`)
  console.error(`- usdh utility classes: ${hasWidgetUtilities ? 'found' : 'missing'}`)
  process.exit(1)
}

console.log('Demo build includes @usdh-kit/widget CSS.')
