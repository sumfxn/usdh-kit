# Bridge and swap flow

The main retail path is `USDC HyperEVM -> USDH HyperCore`.

`bridgeAndSwap()` handles the full flow:

1. quote the `USDH/USDC` spot pair
2. inspect spendable HyperCore USDC
3. route directly from HyperCore if there is enough USDC
4. otherwise bridge USDC from HyperEVM to HyperCore
5. submit an IOC spot order for USDH

## Minimum amount

Hyperliquid spot orders need more than 10 USDC notional. Use `11_000_000n` or more for USDC amounts in SDK examples.

## If USDC is already on HyperCore

The SDK can swap directly:

```ts
await kit.bridgeAndSwap({
  from: 'USDC',
  amount: 11_000_000n,
  sourceChain: 'hypercore',
})
```

The widget calls this the `HyperCore` source.

## If USDC starts on HyperEVM

USDC uses Circle's native bridge route, not a direct ERC-20 transfer to a system address.

The wallet may show two Rabby prompts:

1. approve native USDC to the CoreDepositWallet when allowance is not sufficient
2. deposit USDC into HyperCore spot

After the HyperCore credit lands, the approved agent signs the USDH order. The connected wallet should not receive a third popup for the order itself.

## Progress events

Use `onProgress` for UI state:

```ts
await kit.bridgeAndSwap({
  from: 'USDC',
  amount: 11_000_000n,
  onProgress: (event) => {
    if (event.phase === 'route') console.log(event.route.sourceChain)
    if (event.phase === 'bridging') console.log('waiting for HyperCore credit')
    if (event.phase === 'swapping') console.log('submitting USDH order')
    if (event.phase === 'done') console.log(event.result.swap.orderId)
  },
})
```

## Bridge timeout recovery

`BridgeTimeoutError` means the EVM transaction was submitted but HyperCore was not credited before the timeout. Funds are not lost. Refresh balances or retry the same flow; if HyperCore has credited, route selection should continue from HyperCore instead of sending another bridge.

```ts
import { BridgeTimeoutError, isBridgeAndSwapError } from '@usdh-kit/sdk'

try {
  await kit.bridgeAndSwap({ from: 'USDC', amount: 11_000_000n })
} catch (err) {
  if (isBridgeAndSwapError(err) && err.cause instanceof BridgeTimeoutError) {
    console.log(err.cause.txHash)
  }
}
```

## Current limitations

* Reverse direction (`USDH -> USDC`) is not part of V1.
* `bridgeFromCore` is deferred.
* USDT routing is deferred.
* Allowance-aware approval skipping is a planned UX optimization.
