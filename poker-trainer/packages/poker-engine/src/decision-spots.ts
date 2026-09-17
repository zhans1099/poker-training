import type { Chips, PlayerId, Street } from '@poker-trainer/domain'
import { PokerRuleError } from './errors'

export type DecisionSpot =
  | 'OPEN_RAISE'
  | 'THREE_BET'
  | 'FOUR_BET'
  | 'FIVE_BET_PLUS'
  | 'SQUEEZE'
  | 'LIMP_RERAISE'
  | 'BACK_RAISE'
  | 'CHECK_RAISE'
  | 'RERAISE_POSTFLOP'
  | 'CBET'
  | 'DELAYED_CBET'
  | 'DONK_BET'
  | 'PROBE_BET'
  | 'DOUBLE_BARREL'
  | 'TRIPLE_BARREL'

export interface PublicActionEvent {
  readonly sequence: number
  readonly street: Exclude<Street, 'SHOWDOWN'>
  readonly playerId: PlayerId
  readonly action: 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN'
  readonly to?: Chips
  readonly raisesCurrentBet?: boolean
}

function isAggressive(event: PublicActionEvent): boolean {
  return (
    event.action === 'BET' ||
    event.action === 'RAISE' ||
    (event.action === 'ALL_IN' && event.raisesCurrentBet === true)
  )
}

function previousStreet(
  street: PublicActionEvent['street'],
): PublicActionEvent['street'] | null {
  if (street === 'FLOP') return 'PREFLOP'
  if (street === 'TURN') return 'FLOP'
  if (street === 'RIVER') return 'TURN'
  return null
}

function lastAggressor(
  history: readonly PublicActionEvent[],
  street: PublicActionEvent['street'],
): PlayerId | null {
  return (
    history
      .filter((event) => event.street === street && isAggressive(event))
      .at(-1)?.playerId ?? null
  )
}

export function classifyDecisionSpot(
  history: readonly PublicActionEvent[],
  actionIndex: number,
): DecisionSpot[] {
  const current = history[actionIndex]
  if (current === undefined) {
    throw new PokerRuleError(
      'ILLEGAL_ACTION',
      'Decision spot index is outside action history',
    )
  }
  if (!isAggressive(current)) return []

  const prior = history.slice(0, actionIndex)
  const sameStreetPrior = prior.filter(
    (event) => event.street === current.street,
  )
  const labels: DecisionSpot[] = []

  if (current.street === 'PREFLOP') {
    const priorRaises = sameStreetPrior.filter(isAggressive)
    const raiseNumber = priorRaises.length + 1
    if (raiseNumber === 1) labels.push('OPEN_RAISE')
    else if (raiseNumber === 2) labels.push('THREE_BET')
    else if (raiseNumber === 3) labels.push('FOUR_BET')
    else labels.push('FIVE_BET_PLUS')

    const firstRaiseIndex = sameStreetPrior.findIndex(isAggressive)
    if (raiseNumber === 2 && firstRaiseIndex >= 0) {
      const callersAfterOpen = sameStreetPrior
        .slice(firstRaiseIndex + 1)
        .filter(
          (event) =>
            event.action === 'CALL' && event.playerId !== current.playerId,
        )
      if (callersAfterOpen.length > 0) labels.push('SQUEEZE')
    }

    const actorPrior = sameStreetPrior.filter(
      (event) => event.playerId === current.playerId,
    )
    const actorCall = actorPrior.find((event) => event.action === 'CALL')
    if (actorCall !== undefined) {
      const actionsBeforeCall = sameStreetPrior.slice(
        0,
        sameStreetPrior.indexOf(actorCall),
      )
      if (actionsBeforeCall.some(isAggressive)) labels.push('BACK_RAISE')
      else labels.push('LIMP_RERAISE')
    }
    return labels
  }

  const actorLastCheckIndex = sameStreetPrior.findLastIndex(
    (event) => event.playerId === current.playerId && event.action === 'CHECK',
  )
  if (
    actorLastCheckIndex >= 0 &&
    sameStreetPrior
      .slice(actorLastCheckIndex + 1)
      .some(
        (event) => event.playerId !== current.playerId && isAggressive(event),
      )
  ) {
    labels.push('CHECK_RAISE')
  }
  if (sameStreetPrior.some(isAggressive)) labels.push('RERAISE_POSTFLOP')

  const firstAggressiveThisStreet = !sameStreetPrior.some(isAggressive)
  const priorStreet = previousStreet(current.street)
  const priorStreetAggressor =
    priorStreet === null ? null : lastAggressor(prior, priorStreet)
  const preflopAggressor = lastAggressor(prior, 'PREFLOP')

  if (firstAggressiveThisStreet && current.street === 'FLOP') {
    if (preflopAggressor === current.playerId) labels.push('CBET')
    else if (preflopAggressor !== null) labels.push('DONK_BET')
  }
  if (firstAggressiveThisStreet && current.street === 'TURN') {
    const flopHadBet = prior.some(
      (event) => event.street === 'FLOP' && isAggressive(event),
    )
    if (!flopHadBet && preflopAggressor === current.playerId)
      labels.push('DELAYED_CBET')
    else if (priorStreetAggressor !== current.playerId) labels.push('PROBE_BET')
  }

  const actorAggressiveStreets = new Set(
    prior
      .filter(
        (event) => event.playerId === current.playerId && isAggressive(event),
      )
      .map((event) => event.street),
  )
  if (current.street === 'TURN' && actorAggressiveStreets.has('FLOP')) {
    labels.push('DOUBLE_BARREL')
  }
  if (
    current.street === 'RIVER' &&
    actorAggressiveStreets.has('FLOP') &&
    actorAggressiveStreets.has('TURN')
  ) {
    labels.push('TRIPLE_BARREL')
  }
  return labels
}
