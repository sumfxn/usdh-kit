'use client'

import { useEffect, useState } from 'react'

import type { WidgetTheme } from './types.js'

const PREFERS_DARK = '(prefers-color-scheme: dark)'

/**
 * Resolve `theme` to a concrete `'dark' | 'light'` for rendering.
 *
 * - `dark` / `light` are returned verbatim with no work performed.
 * - `auto` (default for the widget) follows the user's system preference
 *   via `matchMedia('(prefers-color-scheme: dark)')` and re-renders on
 *   change. Listener is only attached for `auto` and is cleaned up when
 *   the prop changes or the component unmounts.
 *
 * Server-rendered output assumes dark (the prevalent DeFi default) so the
 * first paint matches what the majority of users on auto would see; the
 * client effect corrects to light if the system preference says so. This
 * causes a one-frame flash for light-mode auto users and is the standard
 * tradeoff for any prefers-color-scheme implementation that does not
 * read a server-side cookie.
 */
export function useEffectiveTheme(theme: WidgetTheme): 'dark' | 'light' {
  const [systemDark, setSystemDark] = useState<boolean>(true)

  useEffect(() => {
    if (theme !== 'auto') return
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mq = window.matchMedia(PREFERS_DARK)
    setSystemDark(mq.matches)

    const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  if (theme === 'dark') return 'dark'
  if (theme === 'light') return 'light'
  return systemDark ? 'dark' : 'light'
}
