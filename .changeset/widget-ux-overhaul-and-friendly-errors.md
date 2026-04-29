---
'@usdh-kit/widget': minor
'@usdh-kit/sdk': minor
---

feat(widget): UX overhaul and friendly error mapping

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
