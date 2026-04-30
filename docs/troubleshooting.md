# Troubleshooting

Common errors and fixes.

## SDK errors

### `MissingEvmWalletError: bridgeToCore requires evmWallet`

You called `kit.bridgeToCore` without passing `evmWallet` to `createUsdhKit`. Wallet stacks often separate signing (`Signer`) and broadcasting (`EvmWallet`); the kit asks for both explicitly.

```ts
const kit = createUsdhKit({
  network: 'mainnet',
  signer,
  evmWallet: { address: account.address, sendTransaction },
})
```

### `BridgeTimeoutError: HyperCore did not credit within 30s`

The EVM transfer succeeded but the HyperCore credit did not land within the polling window. Funds are safe — they are at the system address waiting for HL to index. Most bridges land in 5–15s; longer points to congestion or a relayer hiccup.

Retry the bridge call with the same arguments. The kit re-checks the HC balance and resolves once the credit appears, even if from a previous tx.

### `InsufficientBalanceError: Insufficient USDC: 1000000 needed, 500000 available`

Pre-flight balance check failed. The widget's source-chain pill exposes both EVM and HC balances side by side so users can flip to the chain they're funded on. CLI consumers should top up the source wallet before the call.

### `InvalidInputError: amount must be a positive bigint`

The amount is `0n`, negative, or not a `bigint`. The kit accepts `bigint` only for amounts (no number coercion) to avoid silent precision loss.

```ts
// wrong
kit.swap({ from: 'USDC', amount: 1.5 })

// right (1.5 USDC = 1_500_000 in 6-decimal smallest unit)
kit.swap({ from: 'USDC', amount: 1_500_000n })
```

### `SigningError: ...`

The signer rejected or returned an invalid signature. For viem `LocalAccount`, double-check the typed-data passthrough — the example apps include the right adapter shape:

```ts
const signer: Signer = {
  address: account.address,
  signTypedData: (args) => account.signTypedData(args as any),
  signMessage: (m) => account.signMessage({ message: typeof m === 'string' ? m : { raw: m } }),
}
```

### `NetworkError: HL error: Order would immediately match resting order at worse than limit`

The orderbook moved between quote and submission — your slippage tolerance was too tight. Widen `slippageBps` (the widget exposes 10/30/50/100 + custom) and retry. The kit passes through the protocol-level message so you can act on it.

### `NetworkError: HL error: Insufficient margin`

You're swapping more than the resolved HC balance net of open orders. The widget's `useUsdcBalances` already subtracts the `hold` field; CLI consumers reading `spotClearinghouseState` directly should do the same.

### `NotImplementedError: USDT swap lands in a follow-up PR`

You called `swap({ from: 'USDT', ... })`. USDT support is deferred (USDT/USDC/USDH double-hop). Use USDC for now.

## Widget errors

### Console: "An empty string was passed to the href attribute"

The demo's `wagmi` chain definitions are missing `blockExplorers`, so ConnectKit renders an explorer link with an empty href. Dev-mode only — not a runtime issue. Fix by passing real explorer URLs in your chain definitions:

```ts
defineChain({
  id: 999,
  name: 'HyperEVM',
  blockExplorers: {
    default: { name: 'Hyperscan', url: 'https://www.hyperscan.com' },
  },
  // ...
})
```

### Borders render bright white in dark mode

The widget's CSS variables are not loaded. The compiled stylesheet must be imported at your app root:

```ts
import '@usdh-kit/widget/styles.css'
```

Without this, every `var(--usdh-*)` falls back to `currentColor`. See [theming](./theming.md) for the full setup.

### The widget palette doesn't match my OS theme

Default `theme="auto"` follows `prefers-color-scheme`. If your app's page background is hardcoded dark while your OS is in light mode, you'll see a light widget on a dark page. Either:

- Make your page background follow `prefers-color-scheme` too (recommended), or
- Force the widget with `<USDHSwap network="mainnet" theme="dark" />`

### SSR flash light → dark on first paint

Standard `prefers-color-scheme` tradeoff. See the cookie-based fix in [theming](./theming.md#avoiding-the-ssr-flash).

## Performance

### Quote refreshes feel slow

`getQuote` debounces by 400ms in the widget. If you're calling the SDK directly, you control the cadence — `getQuote` is a single `/info` round-trip with no signing.

### Bundle size is too large

The widget ships ~38KB ESM. The biggest dependency is the inlined `viem` types via `@usdh-kit/sdk`. If you're already using viem in your app, tree-shaking de-duplicates. If not, the widget pulls in viem.
