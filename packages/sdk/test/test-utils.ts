import { expect } from 'vitest'

export function mockCallArg<T>(
  mock: { mock: { calls: readonly unknown[][] } },
  callIndex: number,
  argIndex: number,
): T {
  const call = mock.mock.calls[callIndex]
  expect(call).toBeDefined()
  return call?.[argIndex] as T
}
