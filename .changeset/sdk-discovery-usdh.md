---
'@usdh-kit/sdk': minor
---

Add USDH spot market discovery. The kit now exposes `listPairs()`, `getPair()`,
`getBook()`, and `getMids()` for every spot pair where USDH is base or quote,
along with the `UsdhPair` type and the underlying `listUsdhSpotPairs` /
`findUsdhSpotPair` helpers. `InfoClient` gains an `allMids()` method to back
mid-price reads.
