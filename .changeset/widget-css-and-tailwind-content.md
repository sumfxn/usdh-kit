---
'@usdh-kit/widget': minor
---

feat(widget): require network prop, ship CSS bundle and tailwind content paths, add smoke tests

Three changes that should land before the first public npm tag:

1. `network` is now required on `<USDHSwap />` and `useUsdhKit`. The
   previous default of `'mainnet'` silently routed swaps to production
   if the integrator forgot to pass the prop. Required props move that
   decision into the type system. **Breaking** for anyone relying on
   the implicit default.

2. The widget renders Tailwind utility classes inline. Without action,
   host apps end up with broken styling: any class unique to the widget
   (the white "Bridge and swap" button, the red error card, the green
   success card, the spinner) is missing from the host's compiled CSS
   because Tailwind only scans the host's own source files. Two new
   entry points fix this:

   - `@usdh-kit/widget/tailwind-content` — array of content globs for
     Tailwind v3 hosts. Spread into your `tailwind.config` so the
     widget's classes are emitted alongside yours. (Tailwind v3 does
     not deep-merge preset `content` arrays, so a preset wouldn't work
     here.)
   - `@usdh-kit/widget/styles.css` — pre-compiled, minified utility
     stylesheet (about 3 KB) for non-Tailwind hosts. Import once at
     your app entry.

   `apps/demo` consumes `tailwind-content` for dogfood. Build pipeline
   adds a `build:css` step using the Tailwind CLI; preflight is
   disabled so the bundle never resets host styles.

3. Smoke tests for `<USDHSwap />` covering the disconnected, idle,
   quote-success, quote-error, and bridge+swap-success paths. wagmi
   and the SDK are mocked at the module level so tests are fast and
   deterministic. Closes a gap between the heavily-tested SDK and the
   previously-untested UI surface.
