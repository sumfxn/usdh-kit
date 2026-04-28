---
'@usdh-kit/widget': minor
---

feat(widget): port USDHSwap from apps/demo

Replaces the placeholder with the working `USDHSwap` component that
quotes, bridges, and swaps USDC into USDH end-to-end. Also exports the
`useUsdhKit` hook for custom UI compositions and the `HyperNetwork`
type. Tailwind classes are inline; a standalone CSS bundle lands in a
follow-up.

`apps/demo` now consumes `@usdh-kit/widget` instead of duplicating the
component locally.
