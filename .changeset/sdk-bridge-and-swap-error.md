---
'@usdh-kit/sdk': minor
'@usdh-kit/widget': patch
---

Add `BridgeAndSwapError` for high-level swap orchestration failures. The error preserves the failing `phase`, underlying `cause`, route context, and optional bridge result so apps can render recovery UI without parsing message strings. The widget now unwraps this error for friendly copy, and the docs clarify `preflightSwap`, `bridgeAndSwap`, progress events, and lifecycle error handling.
