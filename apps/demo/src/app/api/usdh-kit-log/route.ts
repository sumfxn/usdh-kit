import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  const payload = await request.json().catch(() => null)
  if (!isLogPayload(payload)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const method = payload.level === 'error' ? console.error : console.warn
  method(`[usdh-kit browser:${payload.level}]`, {
    at: payload.at,
    args: payload.args,
  })

  return NextResponse.json({ ok: true })
}

function isLogPayload(value: unknown): value is {
  level: 'warn' | 'error'
  at: string
  args: unknown[]
} {
  if (typeof value !== 'object' || value === null) return false
  const shape = value as { level?: unknown; at?: unknown; args?: unknown }
  return (
    (shape.level === 'warn' || shape.level === 'error') &&
    typeof shape.at === 'string' &&
    Array.isArray(shape.args)
  )
}
