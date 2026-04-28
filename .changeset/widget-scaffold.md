---
'@usdh-kit/widget': minor
---

feat(widget): scaffold package with placeholder component

New `@usdh-kit/widget` package. Ships an `USDHSwap` placeholder plus the
build pipeline (tsup ESM+CJS, dts) and peer deps on React 18+, wagmi v2,
viem v2, `@tanstack/react-query` v5, and `@usdh-kit/sdk`. The component
renders a placeholder; the real swap UI is extracted from `apps/demo` in
a follow-up.
