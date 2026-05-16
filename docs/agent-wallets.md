# Agent wallets

Hyperliquid spot orders are L1 actions. They are signed with the `Exchange` typed-data domain and chain ID `1337`, even when the connected browser wallet is on HyperEVM mainnet (`999`) or testnet (`998`).

Some browser wallets reject or mis-handle that direct order-signing flow. The production pattern is to approve a Hyperliquid agent wallet once, then let that agent sign trading actions.

## Roles

| Role | What it does |
|---|---|
| Master wallet | Owns funds, signs agent approval, sends HyperEVM bridge transactions. |
| Agent wallet | Signs Hyperliquid L1 orders such as the sunset `USDH -> USDC` migration swap. |
| `accountAddress` | Tells the SDK which master account to read for balances, routes, and bridge ownership. |

The SDK never treats the agent as the funded account when `accountAddress` is set.

## Browser app pattern

```ts
import { approveAgent, createUsdhKit } from '@usdh-kit/sdk'

await approveAgent({
  network: 'mainnet',
  signer: masterSigner,
  agentAddress: agentSigner.address,
  agentName: 'my-app-usdh-mainnet',
  signatureChainId: 999,
})

const kit = createUsdhKit({
  network: 'mainnet',
  signer: agentSigner,
  accountAddress: masterSigner.address,
  evmWallet: masterEvmWallet,
})
```

Security defaults for browser agents:

* generate a fresh agent per account and network
* scope browser storage by origin, network, and account
* prefer `sessionStorage` over `localStorage`
* never log private keys, raw signatures, or full typed-data payloads
* use named agents so another app's unnamed agent is not replaced accidentally

The widget follows this pattern internally. It asks the user to enable a trading session, then uses the local session agent only for USDH order signing.

## Backend and bot pattern

Backends can use a pre-approved agent key from a secret manager:

```ts
const kit = createUsdhKit({
  network: 'mainnet',
  signer: agentSignerFromKms,
  accountAddress: treasuryAddress,
  evmWallet: treasuryEvmWallet,
})
```

Keep the agent key limited to the operational account and rotate it if the environment is compromised.

## Advanced externally managed agents

Apps that already manage Hyperliquid agents can skip `approveAgent()` in `usdh-kit` and pass the approved signer directly:

```ts
const kit = createUsdhKit({
  network: 'mainnet',
  signer: approvedAgentSigner,
  accountAddress: userMasterAddress,
  evmWallet,
})
```

The important invariant is unchanged: reads and routing use the master account, while L1 orders use the approved agent.
