---
'usdh-kit': minor
---

Internal msgpack encoder for Hyperliquid L1 actions. Supports nil, boolean, integer numbers, bigint, string, array, and plain-object map. Maps preserve insertion order, which HL signing requires. Rejects floats, NaN, infinity, out-of-range bigints, and non-plain objects (Date, Map, Set, etc.). Used by the upcoming swap signing layer.
