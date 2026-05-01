'use client'

import { useEffect } from 'react'

const MARKER = '__usdhKitLogBridgeInstalled'
const LOG_ENDPOINT = '/api/usdh-kit-log'

export function ClientLogBridge() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return

    const registry = window as unknown as Record<string, boolean>
    if (registry[MARKER]) return
    registry[MARKER] = true

    const originalWarn = console.warn.bind(console)
    const originalError = console.error.bind(console)

    console.warn = (...args) => {
      originalWarn(...args)
      forwardUsdhKitLog('warn', args)
    }
    console.error = (...args) => {
      originalError(...args)
      forwardUsdhKitLog('error', args)
    }
  }, [])

  return null
}

function forwardUsdhKitLog(level: 'warn' | 'error', args: unknown[]) {
  if (!isUsdhKitLog(args)) return

  const body = JSON.stringify({
    level,
    args: args.map((arg) => sanitize(arg, 0)),
    at: new Date().toISOString(),
  })

  fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Local dev diagnostics only; never create UI noise from log forwarding.
  })
}

function isUsdhKitLog(args: unknown[]) {
  return typeof args[0] === 'string' && args[0].startsWith('[usdh-kit]')
}

function sanitize(value: unknown, depth: number): unknown {
  if (depth > 5) return '[depth-limit]'
  if (value instanceof Error) {
    return {
      name: value.name,
      message: firstLine(value.message),
      cause: sanitize((value as { cause?: unknown }).cause, depth + 1),
    }
  }
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return firstLine(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1))
  if (typeof value !== 'object') return `[${typeof value}]`

  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    out[key] = shouldRedactKey(key) ? '[redacted]' : sanitize(entry, depth + 1)
  }
  return out
}

function shouldRedactKey(key: string) {
  return /private|secret|password|seed|mnemonic|token|authorization/i.test(key)
}

function firstLine(message: string) {
  const idx = message.indexOf('\n')
  return idx === -1 ? message : message.slice(0, idx)
}
