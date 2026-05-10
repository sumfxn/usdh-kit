# @usdh-kit/sdk

## 0.3.0

### Minor Changes

- a9eb9ab: Add USDH spot market discovery. The kit now exposes `listPairs()`, `getPair()`,
  `getBook()`, and `getMids()` for every spot pair where USDH is base or quote,
  along with the `UsdhPair` type and the underlying `listUsdhSpotPairs` /
  `findUsdhSpotPair` helpers. `InfoClient` gains an `allMids()` method to back
  mid-price reads.

## 0.2.0

### Minor Changes

- 35ee28e: feat(sdk): bridgeToCore for HyperEVM stables to HyperCore

  Adds `kit.bridgeToCore({ asset, amount })` that sends an ERC20 transfer of the
  asset on HyperEVM to its HyperCore system address (`0x20…<tokenIndex BE>`),
  then polls `spotClearinghouseState` until the deposit is reflected. Default
  credit timeout is 30s, overridable via `waitForCreditTimeoutMs`.

  New `KitConfig.evmWallet` (`EvmWallet` interface, minimal `sendTransaction`)
  is required for this method only — `swap` and `getQuote` are unaffected.

  Errors: `MissingEvmWalletError`, `BridgeTimeoutError`.

- ead6d35: Add `isBridgeAndSwapError()` to narrow `BridgeAndSwapError` instances and structural copies safely. The widget now uses the guard before unwrapping lifecycle causes, and the docs cover bridge timeout recovery through `BridgeAndSwapError.cause`.
- 7d1fc55: Add `BridgeAndSwapError` for high-level swap orchestration failures. The error preserves the failing `phase`, underlying `cause`, route context, and optional bridge result so apps can render recovery UI without parsing message strings. The widget now unwraps this error for friendly copy, and the docs clarify `preflightSwap`, `bridgeAndSwap`, progress events, and lifecycle error handling.
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

## 0.1.0

### Minor Changes

- 15f3b80: Internal Hyperliquid `/exchange` transport. `createExchangeClient` posts a signed L1 action with nonce and optional `vaultAddress` to the exchange endpoint, validates the top-level `{ status, response }` envelope, and returns the parsed response. `OrderResponse` and `isOrderResponse` runtime guard typed for the `order` action. `NetworkError` wraps HTTP, transport, JSON, and timeout failures.
- 7942cbc: Implement `getQuote()` for `USDC -> USDH`. Resolves the spot pair from `spotMeta` (cached for the lifetime of the kit), reads the L2 book, and computes a mid-price quote with a 30-second validity window. `KitConfig` now accepts optional `fetch` and `timeoutMs`. USDT pricing throws `NotImplementedError` until the double-hop lands. `Quote` adds a `pair` field naming the spot pair used.
- 84fa2af: Internal Hyperliquid `/info` client. Read-only `spotMeta` and `l2Book` queries via native `fetch`, with `NetworkError` wrapping HTTP, transport, and JSON parse failures. Used by upcoming `getQuote()` implementation.
- f38c6c9: Internal msgpack encoder for Hyperliquid L1 actions. Supports nil, boolean, integer numbers, bigint, string, array, and plain-object map. Maps preserve insertion order, which HL signing requires. Rejects floats, NaN, infinity, out-of-range bigints, and non-plain objects (Date, Map, Set, etc.). Used by the upcoming swap signing layer.
- 0c1db72: Internal HL signing layer: `signL1Action({ signer, action, nonce, network, vaultAddress? })` produces an EIP-712 signature `{ r, s, v }` for any L1 action. Computes the action hash by msgpack-encoding the action, appending the nonce big-endian and the vault marker, then keccak256, and wraps it in HL's phantom-agent typed data (chainId 1337). Adds `@noble/hashes` as the only runtime dep. Used by upcoming `swap()` execution.
- 49c5354: Initial SDK skeleton. Public types (Signer, KitConfig, SwapInput, SwapResult, Quote, Logger), typed error hierarchy rooted at `UsdhKitError`, and `createUsdhKit()` factory with input validation. Execution lands in follow-up PRs.
- b7676de: Implement `swap()` end-to-end for `USDC -> USDH`. Reads the L2 orderbook, computes a slippage-tolerant aggressive limit price (`mid * (1 + slippageBps/10000)`), builds a Market IOC order action, signs via the configured `Signer`, submits to `/exchange`, parses the fill, and returns a `SwapResult` with the realised slippage in bps. The slippage check is now **pre-fill** (HL rejects bad prices itself) and the realised value is reported on the result without throwing. `NetworkError` wraps transport and per-order errors. `NotImplementedError` for USDT until the double-hop lands.

  `SwapResult.txHash` removed (HL L1 actions have no Ethereum tx hash); `orderId` is the canonical identifier. `ResolvedPair` exposes `assetIndex`, `baseSzDecimals`, and `quoteWeiDecimals` so the kit formats price and size strings against the actual pair precision instead of a hardcoded constant. Nonces are emitted monotonically across concurrent calls. `formatDecimal` accepts an optional `maxFracDigits` cap.
