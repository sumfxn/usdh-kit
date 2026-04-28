---
'@usdh-kit/sdk': minor
'@usdh-kit/widget': minor
---

fix(sdk): retire SlippageExceededError, memoize useUsdhKit, drop dead code

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
