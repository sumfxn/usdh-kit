# Architecture

What `@usdh-kit/sdk` actually does under the hood, in the order it does it.

## Layout

```
packages/sdk/src
├── kit.ts            entry point: createUsdhKit(config) → UsdhKit
├── pair-resolver.ts  caches the USDH/USDC spot pair from /info
├── pricing.ts        decimal parsing, mid-price computation
├── bridge.ts         HyperEVM ↔ HyperCore transfers + credit polling
├── signing.ts        EIP-712 typed-data signing for HL L1 actions
├── msgpack.ts        canonical msgpack encoding (action_hash input)
├── abi.ts            ERC-20 approve/deposit/transfer encoding for bridge txs
├── agent.ts          approveAgent user-signed action helper
├── usdc.ts           native HyperEVM USDC addresses
├── bytes.ts          hex / bytes utilities
├── errors.ts         typed UsdhKitError hierarchy
├── transport
│   ├── info.ts       /info read endpoint client (createInfoClient)
│   ├── exchange.ts   /exchange write endpoint client
│   └── types.ts      L2Book, SpotMeta, SpotBalance shapes
└── types
    ├── bridge.ts, swap.ts, signer.ts, evm-wallet.ts, …
```

## Initial setup

`createUsdhKit({ network, signer, accountAddress?, evmWallet?, slippageBps?, fetch?, timeoutMs?, logger? })` validates the config synchronously and returns an object exposing `swap`, `getQuote`, `getRoute`, `preflightSwap`, `bridgeAndSwap`, `bridgeToCore`, and `bridgeFromCore`. Two transport clients are created lazily — one for read (`/info`) and one for write (`/exchange`).

When `signer` is an approved Hyperliquid agent wallet, set `accountAddress` to the user's master wallet. Reads, routing, balances, and bridge ownership use `accountAddress`; L1 order signatures use `signer`.

The USDH/USDC pair is resolved on first call (cached for the kit's lifetime) by reading `spotMeta` and matching the canonical token names. This handles the case where Hyperliquid renumbers pair indices.

## getQuote

```
QuoteInput
  ↓ resolve direction (USDC → USDH buy, or USDH → USDC sell)
  ↓ resolvePair()
  ↓ info.l2Book(pair.name)
  ↓ midPrice18(book)
  ↓ amount / price or amount * price
  ↓ return Quote { from, to, estimatedReceived }
```

No signing. No state. Quote is valid for 30 seconds (`validUntil`).

## getRoute / preflightSwap

```
RouteInput
  ↓ validate source + target + amount + slippage
  ↓ resolvePair()
  ↓ info.l2Book(pair.name) → Quote
  ↓ info.spotClearinghouseState(user) → HyperCore source balance
  ↓ spendable = total - hold (floored at zero)
  ↓ requiredHypercoreBalance = source amount + optional buy buffer + HC fee buffer
  ↓ choose sourceChain:
      ├── HyperCore covers → sourceChain: 'hypercore'
      └── otherwise        → sourceChain: 'hyperevm'
  ↓ return SwapRoute { quote, sourceChain, requiresBridge, canSwap, balances }
```

`preflightSwap()` is an alias for `getRoute()` so UI code can use the name that
best matches its intent. These helpers inspect spendable HyperCore balance only; they do not read the user's HyperEVM ERC20 balance. `USDH → USDC` is HyperCore-only in v1 because there is no HyperEVM direct swap router in scope. `getHypercoreBalance()` is exposed separately for apps that want to display `total`, `hold`, and `available` without computing a route.

## swap

```
SwapInput
  ↓ resolve direction
  ↓ resolvePair()
  ↓ info.l2Book(pair.name)
  ↓ midPrice18(book)
  ↓ buy:  limitPrice18 = mid * (10000 + slippageBps) / 10000
  ↓ sell: limitPrice18 = mid * (10000 - slippageBps) / 10000
  ↓ build msgpack action: { type: 'order', orders: [{ a, b, p, s, r: false, t: { limit: { tif: 'Ioc' } } }], grouping: 'na' }
  ↓ signL1Action({ signer, action, nonce, network, expiresAfter })
  │     ├── canonical msgpack encode of action
  │     ├── keccak256 → action_hash
  │     ├── EIP-712 typed data domain ('Exchange', chainId 1337)
  │     └── signer.signTypedData(...)
  ↓ exchange.submit({ action, signature, nonce })
  ↓ parse response.statuses[0]
      ├── filled  → SwapResult { orderId, received, spent, price, slippageBps }
      ├── resting → throw NetworkError('IOC rested unexpectedly')
      └── error   → throw NetworkError(`order error: ${...}`)
```

For `USDC → USDH`, the order buys USDH (`b: true`) with a max price of `mid + slippageBps`. For `USDH → USDC`, the order sells USDH (`b: false`) with a min price of `mid - slippageBps`. The kit's realised slippage (`SwapResult.slippageBps`) is computed from `avgPx` vs `mid`.

## bridgeToCore

```
BridgeInput
  ↓ resolveAsset() → { evmAddress, decimals, hcTokenIndex, bridge target }
  ↓ USDC: approve native USDC, then CoreDepositWallet.deposit(amount, spot)
  ↓ other linked assets: ERC-20 transfer(systemAddress, amount)
  ↓ poll info.spotClearinghouseState(user) until balance increases
  │     ├── default timeout: 180s
  │     └── on timeout: throw BridgeTimeoutError
  ↓ return BridgeResult { txHash, creditedAt }
```

No explicit HyperCore-side signing — the credit is automatic once the EVM tx confirms and Hyperliquid's relayer indexes it.

For USDC, the wallet can see two HyperEVM transactions: `approve` if allowance is insufficient, then `deposit`. The final `USDC → USDH` trade is a HyperCore order signed separately by the configured `signer` (usually an approved agent in browser apps).

## bridgeFromCore

```
BridgeFromCoreInput
  ↓ resolve linked token + system address from spotMeta
  ↓ require signer.address === accountAddress
  ↓ read spendable HyperCore balance
  ↓ sign user-signed sendAsset action
      ├── EIP-712 typed data domain ('HyperliquidSignTransaction', chainId 0x66eee)
      └── token = USDC or tokenName:tokenId, destination = system address
  ↓ exchange.submit({ action, signature, nonce })
  ↓ return BridgeFromCoreResult { systemAddress, recipient, submittedAt }
```

`bridgeFromCore()` supports linked `USDC` and `USDH` spot assets. It does not accept an arbitrary HyperEVM recipient in v1: Hyperliquid credits the EVM-side account associated with the Core action sender, so the safest public API is sender-owned bridge-out only.

## bridgeAndSwap

```
BridgeAndSwapInput
  ↓ getRoute()
  ↓ if route is blocked:
      ├── missing evmWallet → MissingEvmWalletError
      └── forced HC shortfall → InsufficientBalanceError
  ↓ if requiresBridge:
      bridgeToCore({ asset: from, amount })
      └── unexpected failure → BridgeAndSwapError { phase: 'bridging', route, cause }
  ↓ swap({ from, amount, slippageBps })
      └── unexpected failure → BridgeAndSwapError { phase: 'swapping', route, bridge?, cause }
  ↓ return BridgeAndSwapResult { route, bridge?, swap }
```

The helper emits optional progress events: `route`, `bridging`, `swapping`,
`done`. It intentionally re-quotes inside `swap()` after a bridge completes so
the order limit is based on fresh book state. Reverse `USDH → USDC` routes do
not bridge from HyperEVM first; callers can run `bridgeFromCore()` after the
swap if they need the USDC on HyperEVM. `BridgeAndSwapError` is reserved for
lifecycle failures where phase context matters; route blockers still throw
`MissingEvmWalletError` or `InsufficientBalanceError` directly.

## Errors

All SDK errors extend `UsdhKitError`. Subclasses give consumers `instanceof` granularity:

- `MissingEvmWalletError` — `bridgeToCore` called without `evmWallet`
- `InsufficientBalanceError` — pre-flight balance check failed
- `BridgeTimeoutError` — credit never landed within timeout
- `BridgeAndSwapError` — wraps unexpected `bridgeAndSwap` route, bridge, or swap failures with `phase`, `route`, optional `bridge`, and `cause`; `isBridgeAndSwapError()` narrows both class instances and structural copies
- `InvalidInputError` — amount, decimal string, bridge ownership, or other input is malformed
- `SigningError` — `signer.signTypedData` rejected or returned invalid sig
- `NetworkError` — `/info` or `/exchange` fetch failed, or HL returned a protocol-level error
- `NotImplementedError` — feature deferred (e.g. USDT path)

The widget's `friendlyError(err)` helper maps these to short copy-safe strings (`Insufficient USDC. Add funds and retry.`, etc.).

## Transport

`InfoClient` (`createInfoClient`) is exposed as a public export so consumers can build read-only UIs without re-implementing the wire format. Methods include `spotMeta()`, `outcomeMeta()`, `spotClearinghouseState(user)`, `l2Book(coin)`, and `allMids()`. Server-friendly (works on Node, Bun, edge, browser).

Outcome reads are experimental and read-only. The SDK validates `outcomeMeta`,
derives encoded side coins like `#200`, and reuses the hardened `l2Book()` path
for books. It does not place outcome orders or claim a settlement asset.

`ExchangeClient` is internal — consumers should call `kit.swap()`, `kit.bridgeFromCore()`, or the order helpers rather than building actions themselves.

## Bridge polling internals

`bridgeToCore` polls every ~1s up to the timeout. The detector reads `spotClearinghouseState`, finds the row matching `hcTokenIndex`, and compares the `total` field against the balance recorded before submitting the bridge transaction. This avoids waiting for a second phantom credit when HyperCore updates before the wallet returns control.

This means: the EVM tx must confirm, Hyperliquid's relayer must observe it, and the HL state must reflect the credit before `bridgeToCore` resolves. Healthy mainnet credits are often quick but can take around 1-2 minutes; the default timeout is 180 seconds.
