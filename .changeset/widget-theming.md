---
'@usdh-kit/widget': minor
---

feat(widget): light, dark and auto theming with WCAG-AA defaults

The widget palette is now driven by CSS variables defined in the shipped
stylesheet. `USDHSwap` accepts a new optional `theme` prop:

- `'auto'` (default) — follow the user's system preference via
  `prefers-color-scheme`. The widget re-renders when the OS theme
  changes.
- `'dark'` — force the dark palette.
- `'light'` — force the light palette.

Defaults are tuned for WCAG AA contrast on every body text against the
surface it sits on, in both modes. Integrators can override any token
in their own stylesheet (loaded after the widget's stylesheet) to
customise the palette without forking the widget, e.g.

```css
.usdh-widget.dark { --usdh-bg: 8 4 16; }
```

Tokens follow the `rgb(<r> <g> <b>)` triple format so Tailwind's
`<alpha-value>` substitution works as expected with classes such as
`bg-usdh-surface/40`.

The `useEffectiveTheme(theme)` hook is also exported for consumers
building their own UI on top of the SDK who want the same
auto-detection behaviour.
