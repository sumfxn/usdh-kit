---
'@usdh-kit/sdk': minor
---

feat(sdk): bridgeToCore for HyperEVM stables to HyperCore

Adds `kit.bridgeToCore({ asset, amount })` that sends an ERC20 transfer of the
asset on HyperEVM to its HyperCore system address (`0x20…<tokenIndex BE>`),
then polls `spotClearinghouseState` until the deposit is reflected. Default
credit timeout is 30s, overridable via `waitForCreditTimeoutMs`.

New `KitConfig.evmWallet` (`EvmWallet` interface, minimal `sendTransaction`)
is required for this method only — `swap` and `getQuote` are unaffected.

Errors: `MissingEvmWalletError`, `BridgeTimeoutError`.
