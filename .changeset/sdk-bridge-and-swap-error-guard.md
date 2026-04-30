---
'@usdh-kit/sdk': minor
'@usdh-kit/widget': patch
---

Add `isBridgeAndSwapError()` to narrow `BridgeAndSwapError` instances and structural copies safely. The widget now uses the guard before unwrapping lifecycle causes, and the docs cover bridge timeout recovery through `BridgeAndSwapError.cause`.
