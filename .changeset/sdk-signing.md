---
'usdh-kit': minor
---

Internal HL signing layer: `signL1Action({ signer, action, nonce, network, vaultAddress? })` produces an EIP-712 signature `{ r, s, v }` for any L1 action. Computes the action hash by msgpack-encoding the action, appending the nonce big-endian and the vault marker, then keccak256, and wraps it in HL's phantom-agent typed data (chainId 1337). Adds `@noble/hashes` as the only runtime dep. Used by upcoming `swap()` execution.
