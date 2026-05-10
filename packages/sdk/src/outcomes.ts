import { InvalidInputError, NetworkError } from './errors.js'
import type { InfoClient, NSigFigs } from './transport/info.js'
import type { L2Book, OutcomeMeta, OutcomeMetaOutcome } from './transport/types.js'

export type OutcomeSide = 0 | 1

export interface OutcomeSideMarket {
  side: OutcomeSide
  name: string
  encoding: number
  coin: `#${number}`
  tokenName: `+${number}`
  assetId: number
}

export interface UsdhOutcomeMarket {
  outcome: number
  name: string
  description: string
  descriptionFields: Record<string, string>
  sides: [OutcomeSideMarket, OutcomeSideMarket]
}

export interface GetOutcomeMarketInput {
  outcome: number
}

export interface GetOutcomeBookInput extends GetOutcomeMarketInput {
  side: OutcomeSide
  nSigFigs?: NSigFigs
}

const OUTCOME_ASSET_ID_OFFSET = 100_000_000
const MAX_OUTCOME_ID = Math.floor((Number.MAX_SAFE_INTEGER - OUTCOME_ASSET_ID_OFFSET - 1) / 10)

export function createOutcomeDiscovery(info: InfoClient): {
  listOutcomeMarkets(): Promise<UsdhOutcomeMarket[]>
  getOutcomeMarket(input: GetOutcomeMarketInput): Promise<UsdhOutcomeMarket>
  getOutcomeBook(input: GetOutcomeBookInput): Promise<L2Book>
  getOutcomeMids(): Promise<Record<string, string>>
} {
  let marketsCache: Promise<UsdhOutcomeMarket[]> | null = null

  async function loadMarkets(): Promise<UsdhOutcomeMarket[]> {
    if (marketsCache === null) {
      marketsCache = info.outcomeMeta().then(normalizeOutcomeMeta)
    }
    return marketsCache
  }

  return {
    listOutcomeMarkets() {
      return loadMarkets()
    },
    async getOutcomeMarket(input) {
      validateOutcome(input.outcome)
      const market = (await loadMarkets()).find((candidate) => candidate.outcome === input.outcome)
      if (market === undefined) {
        throw new NetworkError(`outcome ${input.outcome} not found in outcomeMeta`)
      }
      return market
    },
    getOutcomeBook(input) {
      return info.l2Book(outcomeCoin(input.outcome, input.side), input.nSigFigs)
    },
    async getOutcomeMids() {
      const mids = await info.allMids()
      return Object.fromEntries(Object.entries(mids).filter(([coin]) => coin.startsWith('#')))
    },
  }
}

export function normalizeOutcomeMeta(meta: OutcomeMeta): UsdhOutcomeMarket[] {
  return meta.outcomes.map(normalizeOutcome)
}

export function outcomeEncoding(outcome: number, side: OutcomeSide): number {
  validateOutcome(outcome)
  validateOutcomeSide(side)
  return 10 * outcome + side
}

export function outcomeCoin(outcome: number, side: OutcomeSide): `#${number}` {
  return `#${outcomeEncoding(outcome, side)}`
}

export function outcomeTokenName(outcome: number, side: OutcomeSide): `+${number}` {
  return `+${outcomeEncoding(outcome, side)}`
}

export function outcomeAssetId(outcome: number, side: OutcomeSide): number {
  return OUTCOME_ASSET_ID_OFFSET + outcomeEncoding(outcome, side)
}

function normalizeOutcome(outcome: OutcomeMetaOutcome): UsdhOutcomeMarket {
  validateOutcome(outcome.outcome)
  const yes = sideMarket(outcome, 0)
  const no = sideMarket(outcome, 1)
  return {
    outcome: outcome.outcome,
    name: outcome.name,
    description: outcome.description,
    descriptionFields: parseDescriptionFields(outcome.description),
    sides: [yes, no],
  }
}

function sideMarket(outcome: OutcomeMetaOutcome, side: OutcomeSide): OutcomeSideMarket {
  const sideSpec = outcome.sideSpecs[side]
  if (sideSpec === undefined) {
    throw new NetworkError(`outcome ${outcome.outcome} is missing side ${side}`)
  }
  const encoding = outcomeEncoding(outcome.outcome, side)
  return {
    side,
    name: sideSpec.name,
    encoding,
    coin: `#${encoding}`,
    tokenName: `+${encoding}`,
    assetId: OUTCOME_ASSET_ID_OFFSET + encoding,
  }
}

function parseDescriptionFields(description: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const part of description.split('|')) {
    const separator = part.indexOf(':')
    if (separator <= 0) continue
    const key = part.slice(0, separator)
    const value = part.slice(separator + 1)
    if (key !== '' && value !== '') fields[key] = value
  }
  return fields
}

function validateOutcome(outcome: number): void {
  if (!Number.isSafeInteger(outcome) || outcome < 0 || outcome > MAX_OUTCOME_ID) {
    throw new InvalidInputError(`outcome must be a safe integer in [0, ${MAX_OUTCOME_ID}]`)
  }
}

function validateOutcomeSide(side: number): asserts side is OutcomeSide {
  if (side !== 0 && side !== 1) {
    throw new InvalidInputError('outcome side must be 0 or 1')
  }
}
