# Theming the widget

`@usdh-kit/widget` ships with light, dark and auto modes plus a CSS variable system that lets integrators rebrand without forking.

## The `theme` prop

```tsx
<USDHMigration network="mainnet" theme="auto" />   // default - follows prefers-color-scheme
<USDHMigration network="mainnet" theme="dark" />   // force dark
<USDHMigration network="mainnet" theme="light" />  // force light
```

`auto` listens to the system preference via `matchMedia('(prefers-color-scheme: dark)')` and re-renders when it changes. SSR renders dark by default to match the most common DeFi expectation; the client effect corrects to light if the system says so. This causes a one-frame flash for light-mode auto users; the standard fix is to read a server-side cookie and pass it as `theme` from the parent (see Next.js example below).

## CSS variables

The widget root is `.usdh-widget` with a `.dark` class added when the effective theme is dark. Both selectors define the same variables:

| Token | Light default | Dark default | Use |
|---|---|---|---|
| `--usdh-bg` | `255 255 255` | `10 10 10` | outer card background |
| `--usdh-surface` | `250 250 250` | `23 23 23` | pay/receive cards |
| `--usdh-surface-2` | `245 245 245` | `38 38 38` | secondary surfaces |
| `--usdh-border` | `229 229 229` | `64 64 64` | default border |
| `--usdh-border-strong` | `212 212 212` | `82 82 82` | emphasised border |
| `--usdh-text` | `23 23 23` | `250 250 250` | primary heading + amount |
| `--usdh-text-2` | `38 38 38` | `229 229 229` | secondary heading |
| `--usdh-text-muted` | `64 64 64` | `212 212 212` | body text |
| `--usdh-text-soft` | `82 82 82` | `163 163 163` | labels / metadata |
| `--usdh-text-faint` | `115 115 115` | `115 115 115` | fine print |
| `--usdh-placeholder` | `163 163 163` | `82 82 82` | input placeholder |
| `--usdh-cta-bg` | `23 23 23` | `245 245 245` | primary action background |
| `--usdh-cta-bg-hover` | `0 0 0` | `255 255 255` | primary action hover |
| `--usdh-cta-text` | `250 250 250` | `23 23 23` | primary action text |
| `--usdh-chip-bg` | `245 245 245` | `23 23 23` | slippage chip resting |
| `--usdh-chip-active-bg` | `23 23 23` | `245 245 245` | slippage chip active |
| `--usdh-chip-active-text` | `250 250 250` | `23 23 23` | slippage chip active text |

Values are RGB triples (no `rgb()` wrapper) so Tailwind's `<alpha-value>` substitution applies opacity classes like `bg-usdh-surface/40`.

Defaults target WCAG AA contrast on every body text against the surface it sits on, in both modes.

## Overriding

Override any token in your own stylesheet, loaded **after** the widget's stylesheet:

```css
/* app/globals.css */
@import '@usdh-kit/widget/styles.css';

.usdh-widget {
  /* light mode brand accent */
  --usdh-cta-bg: 99 102 241;     /* indigo-500 */
  --usdh-cta-bg-hover: 79 70 229; /* indigo-600 */
}

.usdh-widget.dark {
  /* deeper bg + same indigo accent */
  --usdh-bg: 8 4 16;
  --usdh-cta-bg: 129 140 248;     /* indigo-400 */
  --usdh-cta-bg-hover: 165 180 252; /* indigo-300 */
}
```

You don't need to override every token - unset ones inherit from the defaults.

## Loading the stylesheet

The widget's compiled stylesheet is exposed at `@usdh-kit/widget/styles.css`. Import it once at your application root:

```ts
// Next.js - app/layout.tsx
import '@usdh-kit/widget/styles.css'
```

```ts
// Vite - main.tsx
import '@usdh-kit/widget/styles.css'
```

Without this import, the widget renders unstyled (CSS variables fall back to `currentColor`, borders look bright, etc.).

## Avoiding the SSR flash

If you serve `theme="auto"` and want to avoid the one-frame light/dark flip, store the user's resolved theme in a cookie and pass it as a concrete `dark`/`light` prop server-side:

```tsx
// app/layout.tsx (Next.js, with cookies())
import { cookies } from 'next/headers'

const themeCookie = cookies().get('usdh-theme')?.value as 'dark' | 'light' | undefined
const theme = themeCookie ?? 'auto'

return <USDHMigration network="mainnet" theme={theme} />
```

Then on the client, write the cookie when the resolved theme is known:

```tsx
import { useEffectiveTheme } from '@usdh-kit/widget'

function ThemeCookie({ theme }: { theme: 'dark' | 'light' | 'auto' }) {
  const effective = useEffectiveTheme(theme)
  useEffect(() => {
    document.cookie = `usdh-theme=${effective}; path=/; max-age=31536000; samesite=lax`
  }, [effective])
  return null
}
```

`useEffectiveTheme(theme)` is the same hook the widget uses internally - you can also call it standalone if you're building custom UI with the SDK and want auto-detection without rendering the widget.

## Tailwind setup

If your app uses Tailwind, point its `content` config at the widget so its classes survive the JIT:

```ts
import widgetContent from '@usdh-kit/widget/tailwind-content'

export default {
  content: ['./src/**/*.{ts,tsx}', ...widgetContent],
} satisfies Config
```
