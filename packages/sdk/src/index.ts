export { createUsdhKit } from './kit.js'
export type { UsdhKit } from './kit.js'
export { approveAgent } from './agent.js'
export type { ApproveAgentArgs, ApproveAgentResult } from './agent.js'
export { HYPER_EVM_NATIVE_USDC, getHyperEvmNativeUsdcAddress } from './usdc.js'
export { findUsdhSpotPair, listUsdhSpotPairs } from './discovery.js'
export type {
  GetMidsOpts,
  GetUsdhPairInput,
  ListUsdhPairsOpts,
  UsdhPair,
} from './discovery.js'
export {
  normalizeOutcomeMeta,
  outcomeAssetId,
  outcomeCoin,
  outcomeEncoding,
  outcomeTokenName,
} from './outcomes.js'
export type {
  CancelOrderInput,
  CancelOrderResult,
  GetOpenOrdersInput,
  GetOrderStatusInput,
  OrderSide,
  PlaceOrderInput,
  PlaceOrderResult,
  Tif,
} from './orders.js'
export type {
  GetOutcomeBookInput,
  GetOutcomeMarketInput,
  OutcomeSide,
  OutcomeSideMarket,
  UsdhOutcomeMarket,
} from './outcomes.js'

export { createInfoClient } from './transport/info.js'
export type { InfoClient, InfoClientConfig, NSigFigs } from './transport/info.js'
export type {
  L2Book,
  L2Level,
  OpenOrder,
  OrderStatusDetail,
  OrderStatusResponse,
  OrderStatusValue,
  OutcomeMeta,
  OutcomeMetaOutcome,
  OutcomeMetaQuestion,
  OutcomeSideSpec,
  SpotBalance,
  SpotClearinghouseState,
  SpotMeta,
  SpotPair,
  SpotToken,
} from './transport/types.js'

export {
  BridgeAndSwapError,
  BridgeTimeoutError,
  InsufficientBalanceError,
  InvalidInputError,
  MissingEvmWalletError,
  NetworkError,
  NotImplementedError,
  SigningError,
  UsdhKitError,
  isBridgeAndSwapError,
} from './errors.js'

export type {
  BridgeAsset,
  BridgeFromCoreAsset,
  BridgeFromCoreInput,
  BridgeFromCoreResult,
  BridgeInput,
  BridgeResult,
  BridgeToCoreAsset,
} from './types/bridge.js'
export type { KitConfig } from './types/config.js'
export type { EvmTransactionRequest, EvmWallet } from './types/evm-wallet.js'
export type { Address, Hex } from './types/hex.js'
export type { Logger } from './types/logger.js'
export { silentLogger } from './types/logger.js'
export type { Network } from './types/network.js'
export type {
  SignTypedDataArgs,
  Signer,
  TypedDataDomain,
  TypedDataField,
} from './types/signer.js'
export type {
  BridgeAndSwapEvent,
  BridgeAndSwapInput,
  BridgeAndSwapResult,
  HypercoreBalance,
  HypercoreBalanceInput,
  Quote,
  QuoteInput,
  RouteBlockReason,
  RouteInput,
  SourceChain,
  SourceStable,
  SwapAsset,
  SwapInput,
  SwapResult,
  SwapRoute,
  TargetStable,
} from './types/swap.js'
