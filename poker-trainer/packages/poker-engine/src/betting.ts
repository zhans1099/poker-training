import type {
  Chips,
  LegalActionSet,
  PlayerAction,
  PlayerId,
  PlayerStatus,
} from '@poker-trainer/domain'
import { PokerRuleError } from './errors'

export interface BettingPlayer {
  readonly seat: number
  readonly playerId: PlayerId
  readonly stack: Chips
  readonly status: PlayerStatus
  readonly streetContribution: Chips
  readonly totalContribution: Chips
}

export interface BettingRoundState {
  readonly status: 'OPEN' | 'COMPLETE' | 'HAND_COMPLETE'
  readonly bigBlind: Chips
  readonly currentBet: Chips
  readonly lastFullRaiseSize: Chips
  readonly lastFullAggressorSeat: number | null
  readonly actedSinceLastFullRaise: readonly number[]
  readonly lastActedAtBet: Readonly<Record<number, Chips | null>>
  readonly actionQueue: readonly number[]
  readonly currentActorSeat: number | null
  readonly players: readonly BettingPlayer[]
  readonly chipsInPlay: Chips
}

export interface CreateBettingRoundInput {
  readonly bigBlind: Chips
  readonly players: readonly BettingPlayer[]
  readonly firstToActSeat: number | null
  readonly lastFullRaiseSize?: Chips
  readonly lastFullAggressorSeat?: number | null
}

function isChips(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function sumChips(players: readonly BettingPlayer[]): Chips {
  return players.reduce(
    (total, player) => total + player.stack + player.totalContribution,
    0,
  )
}

function orderedFrom(
  players: readonly BettingPlayer[],
  afterSeat: number,
): BettingPlayer[] {
  const sorted = [...players].toSorted((left, right) => left.seat - right.seat)
  return [
    ...sorted.filter((player) => player.seat > afterSeat),
    ...sorted.filter((player) => player.seat <= afterSeat),
  ]
}

function queueFrom(
  players: readonly BettingPlayer[],
  afterSeat: number,
  predicate: (player: BettingPlayer) => boolean,
): number[] {
  return orderedFrom(players, afterSeat)
    .filter(predicate)
    .map((player) => player.seat)
}

function playerAt(state: BettingRoundState, seat: number): BettingPlayer {
  const player = state.players.find((candidate) => candidate.seat === seat)
  if (player === undefined) {
    throw new PokerRuleError('INVALID_TABLE', `Unknown seat: ${seat}`)
  }
  return player
}

function assertRoundInvariant(state: BettingRoundState): void {
  if (
    !isChips(state.bigBlind) ||
    state.bigBlind === 0 ||
    !isChips(state.currentBet)
  ) {
    throw new PokerRuleError(
      'INVARIANT_VIOLATION',
      'Betting amounts are invalid',
    )
  }
  const seats = new Set<number>()
  for (const player of state.players) {
    if (
      seats.has(player.seat) ||
      !isChips(player.stack) ||
      !isChips(player.streetContribution) ||
      !isChips(player.totalContribution) ||
      player.streetContribution > player.totalContribution
    ) {
      throw new PokerRuleError(
        'INVARIANT_VIOLATION',
        'Player betting state is invalid',
      )
    }
    seats.add(player.seat)
  }
  const maximumContribution = state.players.reduce(
    (maximum, player) => Math.max(maximum, player.streetContribution),
    0,
  )
  if (
    maximumContribution !== state.currentBet ||
    sumChips(state.players) !== state.chipsInPlay
  ) {
    throw new PokerRuleError(
      'INVARIANT_VIOLATION',
      'Chip conservation or current bet failed',
    )
  }
  for (const seat of state.actionQueue) {
    const player = playerAt(state, seat)
    if (player.status !== 'ACTIVE') {
      throw new PokerRuleError(
        'INVARIANT_VIOLATION',
        'Action queue contains an ineligible player',
      )
    }
  }
  if (state.currentActorSeat !== (state.actionQueue[0] ?? null)) {
    throw new PokerRuleError(
      'INVARIANT_VIOLATION',
      'Current actor must lead the action queue',
    )
  }
}

export function createBettingRound(
  input: CreateBettingRoundInput,
): BettingRoundState {
  if (!isChips(input.bigBlind) || input.bigBlind === 0) {
    throw new PokerRuleError(
      'INVALID_CHIPS',
      'Big blind must be a positive integer',
    )
  }
  if (input.players.length < 2) {
    throw new PokerRuleError(
      'INVALID_TABLE',
      'Betting round requires at least two players',
    )
  }
  const currentBet = input.players.reduce(
    (maximum, player) => Math.max(maximum, player.streetContribution),
    0,
  )
  const canAct = input.players.filter((player) => player.status === 'ACTIVE')
  let firstToAct: number | null = null
  if (input.firstToActSeat !== null) {
    if (!canAct.some((player) => player.seat === input.firstToActSeat)) {
      throw new PokerRuleError('INVALID_TABLE', 'First actor must be active')
    }
    firstToAct = input.firstToActSeat
  }
  const actionQueue =
    firstToAct === null
      ? []
      : [
          firstToAct,
          ...queueFrom(
            canAct,
            firstToAct,
            (player) => player.seat !== firstToAct,
          ),
        ]
  const state: BettingRoundState = {
    status: actionQueue.length === 0 ? 'COMPLETE' : 'OPEN',
    bigBlind: input.bigBlind,
    currentBet,
    lastFullRaiseSize: input.lastFullRaiseSize ?? input.bigBlind,
    lastFullAggressorSeat: input.lastFullAggressorSeat ?? null,
    actedSinceLastFullRaise: [],
    lastActedAtBet: Object.fromEntries(
      input.players.map((player) => [player.seat, null]),
    ),
    actionQueue,
    currentActorSeat: actionQueue[0] ?? null,
    players: input.players.map((player) => ({ ...player })),
    chipsInPlay: sumChips(input.players),
  }
  assertRoundInvariant(state)
  return state
}

function hasRaiseRights(
  state: BettingRoundState,
  player: BettingPlayer,
): boolean {
  const lastLevel = state.lastActedAtBet[player.seat]
  if (lastLevel === null || lastLevel === undefined) return true
  if (lastLevel === 0 && state.currentBet > 0) return true
  return state.currentBet - lastLevel >= state.lastFullRaiseSize
}

export function getLegalActions(
  state: BettingRoundState,
  seat: number,
): LegalActionSet {
  if (state.status !== 'OPEN' || state.currentActorSeat !== seat) {
    throw new PokerRuleError(
      'OUT_OF_TURN',
      'Legal actions are only available to the current actor',
    )
  }
  const player = playerAt(state, seat)
  const toCall = Math.max(0, state.currentBet - player.streetContribution)
  const callAmount = Math.min(toCall, player.stack)
  const maxTo = player.streetContribution + player.stack
  const raiseRightsOpen = hasRaiseRights(state, player)
  const minBetTo =
    state.currentBet === 0 ? player.streetContribution + state.bigBlind : null
  const minRaiseTo =
    state.currentBet > 0 ? state.currentBet + state.lastFullRaiseSize : null
  const canBet =
    raiseRightsOpen &&
    minBetTo !== null &&
    player.stack > 0 &&
    maxTo >= minBetTo
  const canRaise =
    raiseRightsOpen &&
    minRaiseTo !== null &&
    maxTo >= minRaiseTo &&
    maxTo > state.currentBet
  const allInWouldRaise = maxTo > state.currentBet

  return {
    canFold: toCall > 0,
    canCheck: toCall === 0,
    callAmount,
    callTo: toCall > 0 ? player.streetContribution + callAmount : null,
    canCall: toCall > 0 && player.stack > 0,
    canBet,
    canRaise,
    canAllIn: player.stack > 0 && (!allInWouldRaise || raiseRightsOpen),
    minBetTo,
    minRaiseTo,
    maxTo,
    raiseRightsOpen,
  }
}

function assertActionLegal(
  state: BettingRoundState,
  player: BettingPlayer,
  action: PlayerAction,
): void {
  const legal = getLegalActions(state, player.seat)
  switch (action.type) {
    case 'FOLD':
      if (!legal.canFold)
        throw new PokerRuleError(
          'ILLEGAL_ACTION',
          'Cannot fold when check is available',
        )
      return
    case 'CHECK':
      if (!legal.canCheck)
        throw new PokerRuleError(
          'ILLEGAL_ACTION',
          'Cannot check facing a wager',
        )
      return
    case 'CALL':
      if (!legal.canCall || action.to !== legal.callTo) {
        throw new PokerRuleError(
          'INVALID_AMOUNT',
          `Call must be to ${String(legal.callTo)}`,
        )
      }
      return
    case 'BET':
      if (
        !legal.canBet ||
        legal.minBetTo === null ||
        action.to < legal.minBetTo ||
        action.to > legal.maxTo
      ) {
        throw new PokerRuleError(
          'INVALID_AMOUNT',
          'Bet is outside the legal bet-to range',
        )
      }
      return
    case 'RAISE':
      if (
        !legal.canRaise ||
        legal.minRaiseTo === null ||
        action.to < legal.minRaiseTo ||
        action.to > legal.maxTo
      ) {
        throw new PokerRuleError(
          'INVALID_AMOUNT',
          'Raise is outside the legal raise-to range',
        )
      }
      return
    case 'ALL_IN':
      if (!legal.canAllIn || action.to !== legal.maxTo) {
        throw new PokerRuleError(
          'INVALID_AMOUNT',
          `All-in must be to ${legal.maxTo}`,
        )
      }
  }
}

function replacePlayer(
  players: readonly BettingPlayer[],
  replacement: BettingPlayer,
): BettingPlayer[] {
  return players.map((player) =>
    player.seat === replacement.seat ? replacement : player,
  )
}

export function applyBettingAction(
  state: BettingRoundState,
  actorSeat: number,
  action: PlayerAction,
): BettingRoundState {
  if (state.status !== 'OPEN') {
    throw new PokerRuleError(
      'ROUND_COMPLETE',
      'Betting round is already complete',
    )
  }
  if (state.currentActorSeat !== actorSeat) {
    throw new PokerRuleError(
      'OUT_OF_TURN',
      `Seat ${actorSeat} is not the current actor`,
    )
  }
  const actor = playerAt(state, actorSeat)
  assertActionLegal(state, actor, action)

  let players = state.players.map((player) => ({ ...player }))
  let currentBet = state.currentBet
  let lastFullRaiseSize = state.lastFullRaiseSize
  let lastFullAggressorSeat = state.lastFullAggressorSeat
  let actedSinceLastFullRaise = [...state.actedSinceLastFullRaise]
  const lastActedAtBet = { ...state.lastActedAtBet }
  let aggressiveIncrease = false
  let fullIncrease = false
  let updatedActor: BettingPlayer = { ...actor }

  if (action.type === 'FOLD') {
    updatedActor = { ...updatedActor, status: 'FOLDED' }
  } else if (action.type !== 'CHECK') {
    const target = action.to
    const contributionDelta = target - actor.streetContribution
    if (!isChips(contributionDelta) || contributionDelta > actor.stack) {
      throw new PokerRuleError(
        'INVALID_AMOUNT',
        'Action cannot deduct the requested chips',
      )
    }
    aggressiveIncrease = target > currentBet
    const raiseSize = aggressiveIncrease ? target - currentBet : 0
    fullIncrease =
      aggressiveIncrease &&
      (currentBet === 0
        ? target >= state.bigBlind
        : raiseSize >= state.lastFullRaiseSize)
    updatedActor = {
      ...updatedActor,
      stack: actor.stack - contributionDelta,
      streetContribution: target,
      totalContribution: actor.totalContribution + contributionDelta,
      status: actor.stack - contributionDelta === 0 ? 'ALL_IN' : actor.status,
    }
    if (aggressiveIncrease) currentBet = target
    if (fullIncrease) {
      lastFullRaiseSize =
        currentBet === target && state.currentBet === 0 ? target : raiseSize
      lastFullAggressorSeat = actorSeat
      actedSinceLastFullRaise = [actorSeat]
    }
  }

  if (!fullIncrease) {
    actedSinceLastFullRaise = [
      ...new Set([...actedSinceLastFullRaise, actorSeat]),
    ]
  }
  lastActedAtBet[actorSeat] = currentBet
  players = replacePlayer(players, updatedActor)

  let actionQueue: number[]
  if (aggressiveIncrease) {
    actionQueue = queueFrom(
      players,
      actorSeat,
      (player) =>
        player.status === 'ACTIVE' && player.streetContribution < currentBet,
    )
  } else {
    actionQueue = state.actionQueue.slice(1)
  }

  const playersStillInHand = players.filter(
    (player) => player.status !== 'FOLDED' && player.status !== 'SITTING_OUT',
  )
  let status: BettingRoundState['status'] = 'OPEN'
  if (playersStillInHand.length === 1) {
    status = 'HAND_COMPLETE'
    actionQueue = []
  } else if (actionQueue.length === 0) {
    status = 'COMPLETE'
  }

  const nextState: BettingRoundState = {
    ...state,
    status,
    currentBet,
    lastFullRaiseSize,
    lastFullAggressorSeat,
    actedSinceLastFullRaise,
    lastActedAtBet,
    actionQueue,
    currentActorSeat: actionQueue[0] ?? null,
    players,
  }
  assertRoundInvariant(nextState)
  return nextState
}

export function assertBettingRoundInvariant(state: BettingRoundState): void {
  assertRoundInvariant(state)
}
