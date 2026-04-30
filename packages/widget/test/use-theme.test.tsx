import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useEffectiveTheme } from '../src/use-theme.js'

type Listener = (event: MediaQueryListEvent) => void

describe('useEffectiveTheme', () => {
  let listeners: Listener[] = []
  let mqMatches = false

  beforeEach(() => {
    listeners = []
    mqMatches = false
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: mqMatches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: (_: string, cb: Listener) => listeners.push(cb),
        removeEventListener: (_: string, cb: Listener) => {
          const i = listeners.indexOf(cb)
          if (i >= 0) listeners.splice(i, 1)
        },
        dispatchEvent: vi.fn(() => true),
      })),
    )
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: globalThis.matchMedia,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns "dark" when theme is "dark" regardless of system preference', () => {
    mqMatches = false
    const { result } = renderHook(() => useEffectiveTheme('dark'))
    expect(result.current).toBe('dark')
  })

  it('returns "light" when theme is "light" regardless of system preference', () => {
    mqMatches = true
    const { result } = renderHook(() => useEffectiveTheme('light'))
    expect(result.current).toBe('light')
  })

  it('returns "dark" when theme is "auto" and system prefers dark', () => {
    mqMatches = true
    const { result } = renderHook(() => useEffectiveTheme('auto'))
    expect(result.current).toBe('dark')
  })

  it('returns "light" when theme is "auto" and system prefers light', () => {
    mqMatches = false
    const { result } = renderHook(() => useEffectiveTheme('auto'))
    expect(result.current).toBe('light')
  })

  it('attaches a listener only when theme is "auto"', () => {
    const { unmount: unmountAuto } = renderHook(() => useEffectiveTheme('auto'))
    expect(listeners).toHaveLength(1)
    unmountAuto()

    renderHook(() => useEffectiveTheme('dark'))
    renderHook(() => useEffectiveTheme('light'))
    expect(listeners).toHaveLength(0)
  })

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useEffectiveTheme('auto'))
    expect(listeners).toHaveLength(1)
    unmount()
    expect(listeners).toHaveLength(0)
  })
})
