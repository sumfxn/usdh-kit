import type { Address, Hex } from './hex.js'

/**
 * Wallet abstraction. Mirrors viem's `WalletClient.signTypedData` shape so
 * a viem WalletClient is a near-passthrough adapter.
 */
export interface Signer {
  readonly address: Address
  signTypedData<
    const TTypes extends Record<string, readonly TypedDataField[]>,
    TPrimary extends keyof TTypes & string,
  >(args: SignTypedDataArgs<TTypes, TPrimary>): Promise<Hex>
  signMessage(message: string | Uint8Array): Promise<Hex>
}

export interface SignTypedDataArgs<
  TTypes extends Record<string, readonly TypedDataField[]> = Record<
    string,
    readonly TypedDataField[]
  >,
  TPrimary extends keyof TTypes & string = keyof TTypes & string,
> {
  domain: TypedDataDomain
  types: TTypes
  primaryType: TPrimary
  message: Record<string, unknown>
}

export interface TypedDataDomain {
  name?: string
  version?: string
  chainId?: number
  verifyingContract?: Address
  salt?: Hex
}

export interface TypedDataField {
  name: string
  type: string
}
