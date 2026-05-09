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

export interface OutcomeMarket {
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

export async function listOutcomeMarkets(info: InfoClient): Promise<OutcomeMarket[]> {
  return normalizeOutcomeMeta(await info.outcomeMeta())
}

export async function getOutcomeMarket(
  info: InfoClient,
  input: GetOutcomeMarketInput,
): Promise<OutcomeMarket> {
  validateOutcome(input.outcome)
  const market = (await listOutcomeMarkets(info)).find(
    (candidate) => candidate.outcome === input.outcome,
  )
  if (market === undefined) {
    throw new NetworkError(`outcome ${input.outcome} not found in outcomeMeta`)
  }
  return market
}

export async function getOutcomeBook(
  info: InfoClient,
  input: GetOutcomeBookInput,
): Promise<L2Book> {
  const coin = outcomeCoin(input.outcome, input.side)
  return info.l2Book(coin, input.nSigFigs)
}

export function normalizeOutcomeMeta(meta: OutcomeMeta): OutcomeMarket[] {
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

function normalizeOutcome(outcome: OutcomeMetaOutcome): OutcomeMarket {
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
  if (!Number.isSafeInteger(outcome) || outcome < 0) {
    throw new InvalidInputError('outcome must be a non-negative safe integer')
  }
}

function validateOutcomeSide(side: number): asserts side is OutcomeSide {
  if (side !== 0 && side !== 1) {
    throw new InvalidInputError('outcome side must be 0 or 1')
  }
}
