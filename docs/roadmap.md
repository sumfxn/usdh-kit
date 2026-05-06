# Roadmap proposal

> Status: **proposal**, pending review by @sumfxn. Open questions are flagged inline.
> Drafted by @yaugourt to scope the next set of features before any code lands.

## Goal

Make `@usdh-kit/sdk` cover everything natively tied to USDH on Hyperliquid, so that a
consumer can rely on this kit alone for any USDH-shaped flow without falling back to a
generic Hyperliquid SDK or hand-rolled msgpack.

Concretely that means:

- discover and trade **every** market where USDH is involved (spot, HIP-3 perps,
  outcomes), not only `USDH/USDC`
- expose the full Hyperliquid trading lifecycle (place / cancel / modify / read), not
  only the IOC swap path
- swap **any** stablecoin into USDH with one call, regardless of whether a direct pair
  exists or a multi-hop is needed
- swap on HyperEVM directly when the user is already EVM-side, without forcing a bridge
  to HyperCore

The current SDK ships a narrow USDC→USDH IOC swap on HyperCore plus the HyperEVM →
HyperCore bridge. Everything below extends from there without breaking the existing
public API surface.

---

## Phase 1 — Pair discovery (spot + HIP-3 perps + outcomes)

**Why first.** Every other phase reads from this. Today `pair-resolver.ts` resolves a
single hard-coded `USDH/USDC` pair via `findUsdhUsdcPair`. We need a generic resolver
keyed on the USDH token index (`360` mainnet, `1452` testnet) that works for any pair
where USDH is base or quote, on any market type.

**Changes**

- Replace `findUsdhUsdcPair` with `listUsdhPairs(meta) → ResolvedPair[]` filtering
  `spotMeta.universe` on `tokens.includes(usdhTokenIndex)`. Works for permissionless
  markets deployed later since USDH is an aligned quote asset.
- Add `findPair({ base, quote })` that resolves by **token name** (`HYPE/USDH` has USDH
  as quote, not base — orientation must be explicit).
- Extend `ResolvedPair` with `usdhRole: 'base' | 'quote'` so callers do not need to
  re-derive orientation.
- Replace the kit-level singleton cache with a per-name `Map`.
- Cover HIP-3 perps where the quote token is USDH (e.g. Felix, Ventuals): query the
  perp `meta` of each HIP-3 dex and filter on quote. Surface as `ResolvedPerpPair`.
- Cover outcomes (testnet today): query `outcomeMeta`, surface USDH-denominated outcome
  spots with their encoded ids.

**New public API (read)**

```ts
kit.listPairs(opts?: { include?: ('spot' | 'hip3' | 'outcome')[] }): Promise<ResolvedPair[]>
kit.getPair(name: string): Promise<ResolvedPair>
kit.getBook(pairName: string, opts?: { nSigFigs?: NSigFigs }): Promise<L2Book>
kit.getMids(): Promise<Record<string, string>>
```

`ResolvedPair` becomes a discriminated union over `kind: 'spot' | 'hip3' | 'outcome'`
so consumers can narrow safely.

> **Open question for @sumfxn**: do we want the default `listPairs()` to include all
> three kinds, or default to spot and require an explicit opt-in for hip3/outcome?

---

## Phase 2 — Generic trading client

**Why now.** Phase 1 unlocks pair metadata for any USDH market; what is still missing
is the ability to do anything other than an IOC buy on `USDH/USDC`. This phase pulls
the order plumbing out of `swap()` into a reusable trading module.

**Changes** — new module `packages/sdk/src/trading/`:

- `placeOrder({ pair, side, tif: 'Gtc' | 'Ioc' | 'Alo', price, size, reduceOnly?, cloid?, builder?, grouping? })`
  supporting `limit` and `trigger` order types. `builder` is **caller-supplied**; the
  kit never injects a default builder code.
- `cancelOrder({ pair, oid })` and `cancelByCloid({ pair, cloid })`
- `modifyOrder({ oid, order })` and `batchModify(modifies)`
- `scheduleCancel({ time? })` (dead-man switch; reminder: 5s minimum, 10/day, resets
  00:00 UTC)
- `placeTwap({ pair, side, size, minutes, randomize })` and `cancelTwap({ pair, twapId })`
- Reads: `getOpenOrders({ frontend? })`, `getOrderStatus(oid)`,
  `getFills({ aggregateByTime? })`, `getHistoricalOrders()`, `getUserFees()`

**Shared plumbing**

- Centralise nonce sequencing (currently in `kit.ts:nextNonce`).
- Batch helper that respects the address-based limit (`weight = 1 + floor(N/40)`).
- `formatPrice(pair, raw)` enforcing tick rules (5 sig figs, decimals
  ≤ `MAX_DECIMALS - szDecimals`, `MAX_DECIMALS = 8` for spot, `6` for perps) and
  stripping trailing zeros before signing — the single most common signing bug.
- Map every `orderStatus` rejection / cancel reason to a typed `UsdhKitError` subclass
  with a matching `friendlyError()` entry.
- Existing `swap()` becomes a thin wrapper over `placeOrder` + `finalizeFill` — **no
  breaking change** to the public API.

**Vault / subaccount / agent wallets**

- Allow optional `vaultAddress` at config level with per-call override.
- Add agent-wallet support: `kit.approveAgent({ agentAddress, agentName? })` and a
  config flag to sign trading actions with an agent key while reads still target the
  master account address.

> **Open questions for @sumfxn**:
> 1. Vault / subaccount support priority — phase 2 or later?
> 2. Agent wallets — phase 2 or split into its own phase?

---

## Phase 3 — Any-stable → USDH (and reverse)

**Why now.** Phases 1–2 give us pair coverage and generic order placement. The retail
promise of the kit is "I have a stablecoin, give me USDH" regardless of which stable.
This phase makes that one call, and adds the reverse direction USDH → stable plus
`bridgeFromCore`.

**Changes**

- `swap({ from: <stable>, to: 'USDH', amount, ... })` accepts any stable token name
  resolvable in `spotMeta`. Resolution order:
  1. direct pair `USDH/<stable>` or `<stable>/USDH` if it exists in `listPairs()`
  2. otherwise multi-hop via `USDC` (e.g. `USDT → USDC → USDH`) using the same
     `placeOrder` engine — two fills, one user-facing call, with cumulative slippage
     reported in `SwapResult`
- `swap({ from: 'USDH', to: <stable>, amount, ... })` for the reverse direction, same
  resolution logic.
- `bridgeFromCore({ asset, amount, recipient? })` — `spotSend` to the HyperCore system
  address `0x20000000000000000000000000000000000005ac` with credit polling on the EVM
  side via ERC-20 `Transfer` watch or balance diff.
- `getRoute` updated to understand reverse and stable→stable→USDH flows, exposing the
  intermediate hops in the result.

**Cumulative slippage on multi-hop.** `slippageBps` is enforced **per leg** at the
matcher (we cannot do otherwise — IOC limit at each hop). The kit reports the realised
end-to-end slippage in `SwapResult.slippageBps` and exposes per-leg breakdown for
debugging. Consumers who need a hard end-to-end cap should pre-quote with
`getQuote()` and gate the call themselves.

> **Open question for @sumfxn**: do we cap the multi-hop fan-out at depth 2 (USDC as
> only intermediate), or allow arbitrary routing? I propose depth 2 for V1 — keeps the
> route deterministic and avoids cycle detection.

---

## Phase 4 — HyperEVM direct swap

**Why.** The only USDC→USDH path today goes through the HyperEVM → HyperCore bridge.
Many apps already hold USDC on HyperEVM and would prefer to swap EVM-side: no bridge
delay, no $1 HyperCore account-init fee on first use, simpler gas story.

**Architectural choice (to discuss)**

- (A) Wrapper around one specific DEX. Fastest, but locks the kit in.
- (B) Pluggable `SwapAdapter` interface, first impl = one specific DEX. Slightly more
  boilerplate, evolvable.
- (C) Aggregator over multiple adapters with best-quote routing. Heaviest, defer.

I lean (B) so we can ship one adapter now and add others without a refactor.

**Public API (provisional)**

```ts
kit.evmSwap({ from, to, amount, minOut?, recipient?, deadline? }): Promise<EvmSwapResult>
kit.evmQuote({ from, to, amount }): Promise<EvmQuote>
```

**Plumbing**

- New module `packages/sdk/src/evm/` with `router-abi.ts`, `quoter.ts`, `swap.ts`,
  `adapters/<dex>.ts`. Reuses the existing `EvmWallet` interface.
- ERC-20 allowance flow with optional `infiniteApproval`, allowance caching to avoid
  redundant approve txs.
- `minOut` derived from `evmQuote()` * `(10000 - slippageBps) / 10000`, with optional
  caller-supplied override.

> **Open questions for @sumfxn**:
> 1. **Which HyperEVM DEX should we wrap first?** Which has the deepest USDH liquidity
>    today (HyperSwap, KittenSwap, Project X, …)?
> 2. **V3 fee tiers**: auto-pick best pool by quoter, or expose `feeTier` as caller
>    param?
> 3. **Slippage shape**: caller supplies `slippageBps` and we derive `minOut`, or we
>    expose `priceImpactBps` separately to surface AMM curve slippage explicitly?

---

## Transverse work (no fixed phase)

- **CoreRouter integration** — expose
  `kit.bridgeToCoreVia({ recipient, initializeRecipient })` calling the deployed
  CoreRouter at `0xd296d76984212cf0719d13c9d2f0d3ca3e78d0b7`. Useful for protocols that
  need a custom recipient or want to pay the $1 init fee in USDH.
- **Fees helper** — port the TS formula from
  `/home/yaugourt/usdh/doc/hyperliquid/fees.md` into `pricing.ts` so callers can
  display estimated fees pre-trade. USDH on HyperCore is an aligned quote asset
  (-20% taker, +50% maker rebate, +20% volume contribution); USDH/USDC is a
  stable-stable pair (80% lower).
- **Widget reflections**:
  - Phase 1 → pair dropdown
  - Phase 3 → "any stable" input with route preview
  - Phase 4 → source-chain toggle that picks HyperEVM direct swap when supported

---

## Sequencing

```
P1 (pair discovery)  ──▶  P2 (trading client)  ──▶  P3 (any-stable + reverse + bridgeFromCore)
                                    └──▶  P4 (HyperEVM swap)  [parallel from P1 onwards]
```

P4 only depends on P1, so it can run in parallel with P2/P3 if we are two contributors.

## Versioning

All phases are additive on the public API except P3 (which broadens the `from`/`to`
union types — minor bump under semver pre-1.0 conventions, breaking only for callers
who rely on the unions being narrow). Each phase ships as its own changeset(s) with a
minor bump on `@usdh-kit/sdk` and, where relevant, `@usdh-kit/widget`.

## Index of open questions for @sumfxn

1. P1 — default for `listPairs()`: spot only, or all three kinds?
2. P2 — vault/subaccount support priority: phase 2 or later?
3. P2 — agent wallets: phase 2 or split phase?
4. P3 — multi-hop depth: cap at 2 (via USDC only) or allow arbitrary routing?
5. P4 — first HyperEVM DEX target?
6. P4 — V3 fee tier handling: auto or caller-param?
7. P4 — slippage shape: `slippageBps` only, or expose `priceImpactBps` separately?
8. Are HIP-3 perps in-scope for this kit, or do we leave them to a separate package?
