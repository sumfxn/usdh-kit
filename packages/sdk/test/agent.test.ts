import { describe, expect, it, vi } from 'vitest'

import { approveAgent } from '../src/agent.js'
import { InvalidInputError, NetworkError, SigningError } from '../src/errors.js'
import type { Signer } from '../src/types/signer.js'

const masterSigner: Signer = {
  address: '0x0000000000000000000000000000000000000001',
  signTypedData: async () => `0x${'a'.repeat(64)}${'b'.repeat(64)}1c` as const,
  signMessage: async () => '0x' as const,
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('approveAgent', () => {
  it('signs and submits a named approveAgent action', async () => {
    const signTypedData = vi.fn(
      async () => `0x${'a'.repeat(64)}${'b'.repeat(64)}1c` as `0x${string}`,
    )
    const fetch = vi.fn(async () => jsonResponse({ status: 'ok', response: { type: 'default' } }))
    const signer: Signer = { ...masterSigner, signTypedData }

    const result = await approveAgent({
      network: 'mainnet',
      signer,
      agentAddress: '0x00000000000000000000000000000000000000aA',
      agentName: 'usdh-kit-session',
      signatureChainId: 999,
      fetch: fetch as unknown as typeof globalThis.fetch,
    })

    expect(result.agentAddress).toBe('0x00000000000000000000000000000000000000aa')
    expect(result.agentName).toBe('usdh-kit-session')
    const typedData = signTypedData.mock.calls[0]?.[0]
    expect(typedData?.domain).toMatchObject({
      name: 'HyperliquidSignTransaction',
      version: '1',
      chainId: 999,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    })
    expect(typedData?.primaryType).toBe('HyperliquidTransaction:ApproveAgent')
    expect(typedData?.message).toMatchObject({
      hyperliquidChain: 'Mainnet',
      agentAddress: '0x00000000000000000000000000000000000000aa',
      agentName: 'usdh-kit-session',
    })

    const init = fetch.mock.calls[0]?.[1]
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    expect(body.action).toMatchObject({
      type: 'approveAgent',
      hyperliquidChain: 'Mainnet',
      signatureChainId: '0x3e7',
      agentAddress: '0x00000000000000000000000000000000000000aa',
      agentName: 'usdh-kit-session',
    })
    expect(body.signature).toMatchObject({ v: 28 })
  })

  it('uses Hyperliquid SDK default signature chain when omitted', async () => {
    const signTypedData = vi.fn(
      async () => `0x${'a'.repeat(64)}${'b'.repeat(64)}1c` as `0x${string}`,
    )
    const fetch = vi.fn(async () => jsonResponse({ status: 'ok', response: { type: 'default' } }))
    await approveAgent({
      network: 'testnet',
      signer: { ...masterSigner, signTypedData },
      agentAddress: '0x00000000000000000000000000000000000000aa',
      fetch: fetch as unknown as typeof globalThis.fetch,
    })
    const typedData = signTypedData.mock.calls[0]?.[0]
    expect(typedData?.domain.chainId).toBe(421_614)
    expect(typedData?.message.hyperliquidChain).toBe('Testnet')
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>
    expect((body.action as { signatureChainId?: string }).signatureChainId).toBe('0x66eee')
    expect('agentName' in (body.action as Record<string, unknown>)).toBe(false)
  })

  it('wraps signing failures', async () => {
    const signer: Signer = {
      ...masterSigner,
      signTypedData: async () => {
        throw new Error('user rejected')
      },
    }
    await expect(
      approveAgent({
        network: 'mainnet',
        signer,
        agentAddress: '0x00000000000000000000000000000000000000aa',
      }),
    ).rejects.toBeInstanceOf(SigningError)
  })

  it('throws NetworkError on exchange rejection', async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({ status: 'err', response: 'Cannot approve agent' }),
    )
    await expect(
      approveAgent({
        network: 'mainnet',
        signer: masterSigner,
        agentAddress: '0x00000000000000000000000000000000000000aa',
        fetch: fetch as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toBeInstanceOf(NetworkError)
  })

  it('validates the agent address and name', async () => {
    await expect(
      approveAgent({
        network: 'mainnet',
        signer: masterSigner,
        agentAddress: '0x1234',
      }),
    ).rejects.toBeInstanceOf(InvalidInputError)
    await expect(
      approveAgent({
        network: 'mainnet',
        signer: masterSigner,
        agentAddress: '0x00000000000000000000000000000000000000aa',
        agentName: ' ',
      }),
    ).rejects.toBeInstanceOf(InvalidInputError)
  })
})
