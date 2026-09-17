import type { PlayerAction, PlayerId } from '@poker-trainer/domain'
import { evaluateBestHand } from './evaluator'
import { getLegalActions } from './betting'
import { SeededRng } from './rng'
import type { PokerHandState } from './hand-state'

export interface ProfileBotDecision {
  readonly action: PlayerAction
  readonly reason: string
  readonly features: Readonly<Record<string, number | boolean | string>>
}

function probability(
  profile: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number,
): number {
  const value = profile[key]
  return typeof value === 'number' && value >= 0 && value <= 1
    ? value
    : fallback
}

function preflopStrength(cards: readonly string[]): number {
  const values = cards.map((card) => '23456789TJQKA'.indexOf(card[0]!) + 2)
  const high = Math.max(...values)
  const low = Math.min(...values)
  const pair = high === low
  const suited = cards[0]?.[1] === cards[1]?.[1]
  const connected = Math.abs(high - low) <= 2
  return Math.min(
    1,
    (pair ? 0.42 + high / 24 : (high + low) / 34) +
      (suited ? 0.06 : 0) +
      (connected ? 0.05 : 0),
  )
}

function currentStrength(state: PokerHandState, actorId: PlayerId): number {
  const seat = state.dealt.seats.find(
    (candidate) => candidate.playerId === actorId,
  )
  if (seat === undefined) return 0
  if (state.dealt.street === 'PREFLOP') return preflopStrength(seat.holeCards)
  const evaluated = evaluateBestHand([...seat.holeCards, ...state.dealt.board])
  return Math.min(
    1,
    evaluated.categoryRank / 8 + (evaluated.tiebreak[0] ?? 0) / 100,
  )
}

function aggressiveAction(
  state: PokerHandState,
  actorId: PlayerId,
  allInRoll: number,
): PlayerAction | null {
  const player = state.betting.players.find(
    (candidate) => candidate.playerId === actorId,
  )
  if (player === undefined) return null
  const legal = getLegalActions(state.betting, player.seat)
  if (legal.canAllIn && allInRoll < 0.04)
    return { type: 'ALL_IN', to: legal.maxTo }
  if (legal.canRaise && legal.minRaiseTo !== null) {
    const target = Math.min(
      legal.maxTo,
      Math.max(
        legal.minRaiseTo,
        state.betting.currentBet + Math.max(state.pot, state.betting.bigBlind),
      ),
    )
    return { type: 'RAISE', to: target }
  }
  if (legal.canBet && legal.minBetTo !== null) {
    const target = Math.min(
      legal.maxTo,
      Math.max(legal.minBetTo, Math.round(state.pot * 0.65)),
    )
    return { type: 'BET', to: target }
  }
  return null
}

export function chooseProfileBotAction(input: {
  state: PokerHandState
  actorId: PlayerId
  heroId?: PlayerId
  profile: Readonly<Record<string, unknown>>
  seed: string
}): ProfileBotDecision {
  const player = input.state.betting.players.find(
    (candidate) => candidate.playerId === input.actorId,
  )
  if (player === undefined) throw new Error('Bot actor is not seated')
  const legal = getLegalActions(input.state.betting, player.seat)
  const rng = new SeededRng(input.seed)
  const roll = rng.nextFloat()
  const strength = currentStrength(input.state, input.actorId)
  const vpip = probability(input.profile, 'vpip', 0.4)
  const aggression = probability(input.profile, 'aggressionFactor', 0.45)
  const bluff = probability(input.profile, 'bluffFrequency', 0.2)
  const facingHero = input.state.betting.players.some(
    (candidate) =>
      candidate.seat === input.state.betting.lastFullAggressorSeat &&
      candidate.playerId === input.heroId,
  )
  const stickiness = probability(
    input.profile,
    facingHero ? 'heroCallFrequency' : 'topPairStickiness',
    0.6,
  )
  const toCall = legal.callAmount
  const potOdds = toCall === 0 ? 0 : toCall / (input.state.pot + toCall)
  const willingness =
    input.state.dealt.street === 'PREFLOP'
      ? strength * 0.55 + vpip * 0.45
      : strength * 0.72 + stickiness * 0.28
  const aggressive = aggressiveAction(
    input.state,
    input.actorId,
    rng.nextFloat(),
  )

  let action: PlayerAction
  let reason: string
  if (toCall > 0) {
    if (
      aggressive !== null &&
      (strength > 0.72 || roll < aggression * bluff * 0.35)
    ) {
      action = aggressive
      reason =
        strength > 0.72 ? 'strong-value-aggression' : 'profile-bluff-aggression'
    } else if (
      legal.canCall &&
      willingness + rng.nextFloat() * 0.2 >= potOdds + 0.18
    ) {
      action = { type: 'CALL', to: legal.callTo! }
      reason = 'continue-vs-price'
    } else {
      action = { type: 'FOLD' }
      reason = 'fold-vs-price'
    }
  } else if (
    aggressive !== null &&
    (strength > 0.58 || roll < aggression * (0.25 + bluff * 0.2))
  ) {
    action = aggressive
    reason = strength > 0.58 ? 'value-bet' : 'profile-stab'
  } else {
    action = { type: 'CHECK' }
    reason = 'check-back'
  }

  return {
    action,
    reason,
    features: {
      strength,
      potOdds,
      willingness,
      vpip,
      aggression,
      bluff,
      facingHero,
      roll,
    },
  }
}
