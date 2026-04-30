# Architecture

What `@usdh-kit/sdk` actually does under the hood, in the order it does it.

## Layout

```
packages/sdk/src
├── kit.ts            entry point: createUsdhKit(config) → UsdhKit
├── pair-resolver.ts  caches the USDH/USDC spot pair from /info
├── pricing.ts        decimal parsing, mid-price computation
├── bridge.ts         HyperEVM → HyperCore transfer + credit polling
├── signing.ts        EIP-712 typed-data signing for HL L1 actions
├── msgpack.ts        canonical msgpack encoding (action_hash input)
├── abi.ts            ERC-20 transfer encoding for the bridge tx
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

`createUsdhKit({ network, signer, evmWallet?, slippageBps?, fetch?, timeoutMs?, logger? })` validates the config synchronously and returns an object exposing `swap`, `getQuote`, `getRoute`, `preflightSwap`, `bridgeAndSwap`, and `bridgeToCore`. Two transport clients are created lazily — one for read (`/info`) and one for write (`/exchange`).

The USDH/USDC pair is resolved on first call (cached for the kit's lifetime) by reading `spotMeta` and matching the canonical token names. This handles the case where Hyperliquid renumbers pair indices.

## getQuote

```
QuoteInput → resolvePair() → info.l2Book(pair.name) → midPrice18(book)
                                                   → estimatedReceived
                                                   → return Quote
```

No signing. No state. Quote is valid for 30 seconds (`validUntil`).

## getRoute / preflightSwap

```
RouteInput
  ↓ validate source + amount + slippage
  ↓ resolvePair()
  ↓ info.l2Book(pair.name) → Quote
  ↓ info.spotClearinghouseState(user) → HyperCore source balance
  ↓ spendable = total - hold (floored at zero)
  ↓ requiredHypercoreBalance = amount + slippage buffer + HC fee buffer
  ↓ choose sourceChain:
      ├── HyperCore covers → sourceChain: 'hypercore'
      └── otherwise        → sourceChain: 'hyperevm'
  ↓ return SwapRoute { quote, sourceChain, requiresBridge, canSwap, balances }
```

`preflightSwap()` is an alias for `getRoute()` so UI code can use the name that
best matches its intent. These helpers inspect spendable HyperCore balance only; they do not read the user's HyperEVM ERC20 balance. `getHypercoreBalance()` is exposed separately for apps that want to display `total`, `hold`, and `available` without computing a route.

## swap (USDC path)

```
SwapInput
  ↓ resolvePair()
  ↓ info.l2Book(pair.name)
  ↓ midPrice18(book)
  ↓ limitPrice18 = mid * (10000 + slippageBps) / 10000
  ↓ build msgpack action: { type: 'order', orders: [{ a, b: true, p, s, r: false, t: { limit: { tif: 'Ioc' } } }], grouping: 'na' }
  ↓ signL1Action({ signer, action, nonce, network })
  │     ├── canonical msgpack encode of action
  │     ├── keccak256 → action_hash
  │     ├── EIP-712 typed data domain ('HyperliquidSignTransaction')
  │     └── signer.signTypedData(...)
  ↓ exchange.submit({ action, signature, nonce })
  ↓ parse response.statuses[0]
      ├── filled  → SwapResult { orderId, received, spent, price, slippageBps }
      ├── resting → throw NetworkError('IOC rested unexpectedly')
      └── error   → throw NetworkError(`order error: ${...}`)
```

The IOC limit ensures Hyperliquid's matcher rejects fills at worse than `mid + slippageBps`. The kit's realised slippage (`SwapResult.slippageBps`) is computed from `avgPx` vs `mid`.

## bridgeToCore

```
BridgeInput
  ↓ resolveAsset() → { evmAddress, decimals, hcTokenIndex, systemAddress }
  ↓ encode ERC-20 transfer(systemAddress, amount)
  ↓ evmWallet.sendTransaction({ to: evmAddress, data })  → txHash
  ↓ poll info.spotClearinghouseState(user) until balance increases
  │     ├── default timeout: 30s
  │     └── on timeout: throw BridgeTimeoutError
  ↓ return BridgeResult { txHash, creditedAt }
```

No explicit HyperCore-side signing — the credit is automatic once the EVM tx confirms and Hyperliquid's relayer indexes it.

## bridgeAndSwap

```
BridgeAndSwapInput
  ↓ getRoute()
  ↓ if route is blocked:
      ├── missing evmWallet → MissingEvmWalletError
      └── forced HC shortfall → InsufficientBalanceError
  ↓ if requiresBridge:
      bridgeToCore({ asset: from, amount })
  ↓ swap({ from, amount, slippageBps })
  ↓ return BridgeAndSwapResult { route, bridge?, swap }
```

The helper emits optional progress events: `route`, `bridging`, `swapping`,
`done`. It intentionally re-quotes inside `swap()` after a bridge completes so
the order limit is based on fresh book state.

## Errors

All SDK errors extend `UsdhKitError`. Subclasses give consumers `instanceof` granularity:

- `MissingEvmWalletError` — `bridgeToCore` called without `evmWallet`
- `InsufficientBalanceError` — pre-flight balance check failed
- `BridgeTimeoutError` — credit never landed within timeout
- `InvalidInputError` — amount, decimal string, or other input is malformed
- `SigningError` — `signer.signTypedData` rejected or returned invalid sig
- `NetworkError` — `/info` or `/exchange` fetch failed, or HL returned a protocol-level error
- `NotImplementedError` — feature deferred (e.g. USDT path)

The widget's `friendlyError(err)` helper maps these to short copy-safe strings (`Insufficient USDC. Add funds and retry.`, etc.).

## Transport

`InfoClient` (`createInfoClient`) is exposed as a public export so consumers can build read-only UIs without re-implementing the wire format. Methods include `spotMeta()`, `spotClearinghouseState(user)`, `l2Book(coin)`. Server-friendly (works on Node, Bun, edge, browser).

`ExchangeClient` is internal — consumers should call `kit.swap()` rather than building actions themselves.

## Bridge polling internals

`bridgeToCore` polls every ~2s up to the timeout. The detector reads `spotClearinghouseState`, finds the row matching `hcTokenIndex`, and compares the `total` field against the balance recorded just before submission. First strictly-greater observation wins.

This means: the EVM tx must confirm, Hyperliquid's relayer must observe it, and the HL state must reflect the credit before `bridgeToCore` resolves. On a healthy testnet that's typically 5–15 seconds.
