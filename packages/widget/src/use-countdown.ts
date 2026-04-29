'use client'

import { useEffect, useState } from 'react'

/**
 * Returns `secondsRemaining` based on a target epoch ms, computed
 * synchronously from `Date.now()` on every render. The internal interval is
 * only used to force re-renders once per second; the value itself is always
 * a fresh derivation of `deadlineMs - Date.now()`.
 *
 * Computing synchronously matters: a `useState` initializer runs once at
 * mount, so a deadline that arrives later (e.g. after a quote resolves) would
 * stale-read 0 on the first render and trigger downstream effects (like
 * "quote expired") before the interval has a chance to update state.
 */
export function useCountdown(deadlineMs: number | null): number {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (deadlineMs === null) return
    const id = setInterval(() => setTick((t) => t + 1), 1_000)
    return () => clearInterval(id)
  }, [deadlineMs])

  if (deadlineMs === null) return 0
  const diff = deadlineMs - Date.now()
  return diff <= 0 ? 0 : Math.ceil(diff / 1_000)
}
