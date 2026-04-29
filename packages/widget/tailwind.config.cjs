/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Semantic tokens — resolved from CSS variables defined in
        // src/styles.css. Light mode is the default; the `dark` class
        // (added on the widget root by USDHSwap when the effective theme
        // is dark) overrides each token. Using rgb(var() / <alpha-value>)
        // means consumers can still write `bg-usdh-surface/40`, etc.
        'usdh-bg': 'rgb(var(--usdh-bg) / <alpha-value>)',
        'usdh-surface': 'rgb(var(--usdh-surface) / <alpha-value>)',
        'usdh-surface-2': 'rgb(var(--usdh-surface-2) / <alpha-value>)',
        'usdh-border': 'rgb(var(--usdh-border) / <alpha-value>)',
        'usdh-border-strong': 'rgb(var(--usdh-border-strong) / <alpha-value>)',
        'usdh-text': 'rgb(var(--usdh-text) / <alpha-value>)',
        'usdh-text-2': 'rgb(var(--usdh-text-2) / <alpha-value>)',
        'usdh-text-muted': 'rgb(var(--usdh-text-muted) / <alpha-value>)',
        'usdh-text-soft': 'rgb(var(--usdh-text-soft) / <alpha-value>)',
        'usdh-text-faint': 'rgb(var(--usdh-text-faint) / <alpha-value>)',
        'usdh-placeholder': 'rgb(var(--usdh-placeholder) / <alpha-value>)',
        'usdh-cta-bg': 'rgb(var(--usdh-cta-bg) / <alpha-value>)',
        'usdh-cta-bg-hover': 'rgb(var(--usdh-cta-bg-hover) / <alpha-value>)',
        'usdh-cta-text': 'rgb(var(--usdh-cta-text) / <alpha-value>)',
        'usdh-chip-bg': 'rgb(var(--usdh-chip-bg) / <alpha-value>)',
        'usdh-chip-active-bg': 'rgb(var(--usdh-chip-active-bg) / <alpha-value>)',
        'usdh-chip-active-text': 'rgb(var(--usdh-chip-active-text) / <alpha-value>)',
      },
    },
  },
}
