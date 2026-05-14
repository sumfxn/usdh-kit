const path = require('node:path')

/**
 * Tailwind content paths for `@usdh-kit/widget`.
 *
 * Spread this array into your own Tailwind config's `content` so the
 * widget's utility classes are scanned and emitted alongside your app's:
 *
 *     // tailwind.config.js
 *     const widgetContent = require('@usdh-kit/widget/tailwind-content')
 *     module.exports = {
 *       content: ['./src/** /*.{ts,tsx}', ...widgetContent],
 *     }
 *
 * (Tailwind v3 does not deep-merge `content` arrays from presets, so this
 * is exposed as a plain array instead of a preset object.)
 */
const widgetDir = __dirname.replaceAll(path.sep, path.posix.sep)

module.exports = [`${widgetDir}/dist/**/*.{js,mjs}`]
