# @usdh-kit/widget

## 1.0.0

### Minor Changes

- 0bd4c4b: fix(sdk): retire SlippageExceededError, memoize useUsdhKit, drop dead code

  Three pre-1.0 fixes surfaced by an internal audit:

  1. **`SlippageExceededError` retired.** The post-fill slippage check was
     removed in PR #10 when the matcher started enforcing the limit price
     pre-fill, but the error class and its READMEs example stuck around.
     The export now corresponds to a code path that cannot run, which is
     worse than no export. Removed from `errors.ts` and `index.ts`. Both
     READMEs now demonstrate `result.slippageBps` (realised slippage)
     instead of catching an error that never throws. **Breaking** for
     anyone importing `SlippageExceededError`; replace with reading
     `result.slippageBps` and tightening `slippageBps` if it's higher
     than expected.

  2. **`useUsdhKit` is now memoized.** The hook previously re-ran
     `createUsdhKit(...)` on every render, throwing away the kit's
     monotonic-nonce closure (`lastNonce`), the pair-resolver cache, and
     any in-flight `spotMeta` requests. Wrapped in `useMemo` keyed on
     `[network, address, walletClient, signTypedDataAsync, signMessageAsync]`
     so consumers get a stable kit identity across renders. Adds a
     `renderHook` test that asserts kit identity is preserved across
     rerenders and rebuilt when `network` changes.

  3. **Dead code removed.** `assertBookHasSides` in `kit.ts` was
     unreachable: `midPrice18(book)` runs first on the same `book`
     reference and already throws `NetworkError` when a side is missing.
     Removed the helper, its single call site, and the now-unused `L2Book`
     import. Added a defensive non-zero-pair-index test to
     `pair-resolver.test.ts` to lock the contract that `pair.index` is
     the canonical universe index from spotMeta (mainnet has USDH/USDC at
     index 230, not array position 0).

- 8180915: feat(widget): require network prop, ship CSS bundle and tailwind content paths, add smoke tests

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

- 9de157c: feat(widget): port USDHSwap from apps/demo

  Replaces the placeholder with the working `USDHSwap` component that
  quotes, bridges, and swaps USDC into USDH end-to-end. Also exports the
  `useUsdhKit` hook for custom UI compositions and the `HyperNetwork`
  type. Tailwind classes are inline; a standalone CSS bundle lands in a
  follow-up.

  `apps/demo` now consumes `@usdh-kit/widget` instead of duplicating the
  component locally.

- 2eab63f: feat(widget): scaffold package with placeholder component

  New `@usdh-kit/widget` package. Ships an `USDHSwap` placeholder plus the
  build pipeline (tsup ESM+CJS, dts) and peer deps on React 18+, wagmi v2,
  viem v2, `@tanstack/react-query` v5, and `@usdh-kit/sdk`. The component
  renders a placeholder; the real swap UI is extracted from `apps/demo` in
  a follow-up.

- 5c695c8: feat(widget): light, dark and auto theming with WCAG-AA defaults

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
  .usdh-widget.dark {
    --usdh-bg: 8 4 16;
  }
  ```

  Tokens follow the `rgb(<r> <g> <b>)` triple format so Tailwind's
  `<alpha-value>` substitution works as expected with classes such as
  `bg-usdh-surface/40`.

  The `useEffectiveTheme(theme)` hook is also exported for consumers
  building their own UI on top of the SDK who want the same
  auto-detection behaviour.

- c614acf: feat(widget): UX overhaul and friendly error mapping

  Replaces the placeholder swap form with a connected-state UX that integrators can ship without a custom UI layer. Bundles the friendly-error helper.

  **Widget UX**

  - Stacked you-pay / you-receive cards with per-side balance display: HyperEVM USDC (the bridge source) and HyperCore USDC (where the swap fills) are both shown and refresh on a 12s cadence.
  - Inline slippage chips (0.10 / 0.30 / 0.50 / 1.00 %) plus a custom % input. The chosen value is passed to `kit.swap({ slippageBps })` per call.
  - Auto-quote on amount change (debounced) with the rounded receive estimate displayed without bps drift noise. Stale quotes are cleared once their `validUntil` window elapses so consumers cannot fill against an outdated mid.
  - HC-only swap detection: if the user's HyperCore USDC balance already covers the trade plus a slippage + fee buffer, the bridge step is skipped and the button reads "Swap" instead of "Bridge and swap".
  - Pre-flight insufficient-balance check disables the swap button and switches its label to "Insufficient balance" before the user signs anything.
  - Inline system-address note (`0x2000…0000` is Hyperliquid's USDC system address, not phishing) renders alongside the action button when a bridge is required, so the wallet prompt is never the user's first hint about where funds are going. No intermediate confirm step — click "Bridge and swap" goes straight to the wallet.
  - Wrong-network banner with a `useSwitchChain` button. Inputs and slippage chips are disabled while the wallet is on the wrong chain so accidental clicks cannot reach the SDK. The network toggle is locked once a swap is in flight.
  - MAX button on the pay side that snaps to the user's HyperEVM USDC balance.
  - Optional Sentral + LiquidTerminal watermark, opt-out via `hideAttribution`.

  **Friendly errors**

  - New `friendlyError(err: unknown): string` helper maps common failure modes to short, human-readable strings: viem's `UserRejectedRequestError` (and EIP-1193 code 4001 walked up the cause chain), `MissingEvmWalletError`, `BridgeTimeoutError` (with explicit "funds are safe" guidance), `InsufficientBalanceError` (asset-specific), `InvalidInputError`, `SigningError`, `NotImplementedError`, and `NetworkError` (passes through Hyperliquid protocol-level rejections like "Order would immediately match …" so the user sees the actionable reason, redacts raw RPC payloads otherwise). Used internally for all error display in the widget; also exported for SDK consumers building their own UI.

  **SDK**

  - New public exports: `createInfoClient`, `InfoClient`, `InfoClientConfig`, `NSigFigs`, `L2Book`, `L2Level`, `SpotMeta`, `SpotPair`, `SpotToken`, `SpotBalance`, `SpotClearinghouseState`. The widget needs read-only access to spotMeta and the user's HyperCore balance to render the source/destination balance lines; surfacing the existing `InfoClient` is the smallest change that unblocks any consumer building similar read-only UIs without re-implementing transport.

  Tests added for the friendly-error mappings and connected-state UI (chain mismatch banner, slippage chip toggling, insufficient-balance state, HC-only swap path, debounce cancellation, expiry-driven quote clear).

### Patch Changes

- 84504fc: Restore the Sentral and LiquidTerminal partner marks in the widget watermark with X links, theme-safe colouring, and a dedicated HyperEVM/HyperCore balance row.
- ead6d35: Add `isBridgeAndSwapError()` to narrow `BridgeAndSwapError` instances and structural copies safely. The widget now uses the guard before unwrapping lifecycle causes, and the docs cover bridge timeout recovery through `BridgeAndSwapError.cause`.
- 7d1fc55: Add `BridgeAndSwapError` for high-level swap orchestration failures. The error preserves the failing `phase`, underlying `cause`, route context, and optional bridge result so apps can render recovery UI without parsing message strings. The widget now unwraps this error for friendly copy, and the docs clarify `preflightSwap`, `bridgeAndSwap`, progress events, and lifecycle error handling.
- Updated dependencies [35ee28e]
- Updated dependencies [ead6d35]
- Updated dependencies [7d1fc55]
- Updated dependencies [0bd4c4b]
- Updated dependencies [c614acf]
  - @usdh-kit/sdk@0.2.0
