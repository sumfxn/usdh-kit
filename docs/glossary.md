# Glossary

Hyperliquid-specific terms used across `@usdh-kit/sdk` and `@usdh-kit/widget`.

## Hyperliquid

**HyperEVM** — EVM-compatible execution layer (chain id `999` mainnet, `998` testnet) where USDC is held as a standard ERC-20 and where bridge transactions originate.

**HyperCore** — non-EVM matching engine that runs the spot order book. USDC needs to be on HyperCore (not HyperEVM) before a spot trade can fill.

**System address** — the deterministic ERC-20 receiver per HL token used to bridge from HyperEVM to HyperCore. USDC's system address is `0x2000…0000`. Sending the token to this address triggers a HyperCore credit on the same wallet.

**Bridge polling** — `bridgeToCore` submits the EVM transfer, then polls `spotClearinghouseState` until the credit lands (default timeout 30s). The kit returns once the credit is confirmed; no extra signing needed.

## Trading

**Spot pair** — Hyperliquid spot market. Identified by an alias like `@230` (USDH/USDC) and a numeric `assetIndex`. The pair has a base token (USDH), a quote token (USDC), and decimal conventions for both.

**IOC (Immediate-or-Cancel)** — order type used by `swap()`. Submits a limit order priced one slippage-tier above mid and either fills now or cancels. No resting position is left on the book.

**Mid price** — `(bestBid + bestAsk) / 2` from the L2 orderbook, scaled to 10^18 internally. The kit's "implied price" the user sees pre-trade.

**Slippage (bps)** — basis points (1 bp = 0.01%). The widget exposes 10 / 30 / 50 / 100 bps presets plus a custom field. The realised slippage (`SwapResult.slippageBps`) is the absolute difference between fill price and mid, rescaled to bps.

**weiDecimals / evmExtraWeiDecimals** — Hyperliquid's two-decimal-systems quirk. Tokens have a HyperCore native precision (`weiDecimals`) and an optional offset on HyperEVM (`evmExtraWeiDecimals`). USDC: `weiDecimals=8` on HC, `evmExtraWeiDecimals=10` on EVM (so EVM USDC has 18 effective decimals, HC has 8). The SDK abstracts this; consumers reading `spotMeta` directly need to handle it.

## Stablecoins

**USDH** — Hyperliquid's native stablecoin, issued by Bridge and designed by Native Markets. Backed by cash + US Treasuries. 50% of reserve revenue routes to the Hyperliquid Assistance Fund.

**USDC (HyperEVM)** — Circle's USDC bridged onto HyperEVM. The default source asset for `@usdh-kit/sdk`.

**USDT** — Tether's USDT. Pricing and swap support are deferred (USDT/USDC/USDH double-hop).

## Wallets

**Signer** — wallet-agnostic typed-data + message signing interface. Works with viem, ethers, Privy, Turnkey, raw private key. Required for `swap()`.

**EvmWallet** — minimal interface to send EVM transactions (`{ address, sendTransaction }`). Required for `bridgeToCore()`. Distinct from `Signer` because some wallet stacks separate signing and broadcasting.
