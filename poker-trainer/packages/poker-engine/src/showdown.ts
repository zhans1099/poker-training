import type { Card, Chips, PlayerId, PlayerStatus } from '@poker-trainer/domain'
import { assertUniqueCards } from './cards'
import {
  compareEvaluatedHands,
  evaluateBestHand,
  type EvaluatedHand,
} from './evaluator'
import { PokerRuleError } from './errors'

export interface ShowdownPlayer {
  readonly seat: number
  readonly playerId: PlayerId
  readonly status: PlayerStatus
  readonly totalContribution: Chips
  readonly holeCards: readonly Card[]
}

export interface SidePotResult {
  readonly amount: Chips
  readonly eligiblePlayerIds: readonly PlayerId[]
  readonly winnerPlayerIds: readonly PlayerId[]
}

export interface RunoutResult {
  readonly board: readonly Card[]
  readonly hands: Readonly<Record<PlayerId, EvaluatedHand>>
  readonly pots: readonly SidePotResult[]
}

export interface MultiRunoutSettlement {
  readonly payouts: Readonly<Record<PlayerId, Chips>>
  readonly runouts: readonly RunoutResult[]
}

export interface ShowdownSettlement {
  readonly payouts: Readonly<Record<PlayerId, Chips>>
  readonly hands: Readonly<Record<PlayerId, EvaluatedHand>>
  readonly pots: readonly SidePotResult[]
}

interface SidePot {
  amount: Chips
  eligiblePlayerIds: PlayerId[]
}

function buildSidePots(players: readonly ShowdownPlayer[]): SidePot[] {
  const levels = [
    ...new Set(
      players
        .map((player) => player.totalContribution)
        .filter((amount) => amount > 0),
    ),
  ].toSorted((left, right) => left - right)
  const pots: SidePot[] = []
  let previousLevel = 0
  for (const level of levels) {
    const contributors = players.filter(
      (player) => player.totalContribution >= level,
    )
    const amount = (level - previousLevel) * contributors.length
    const eligiblePlayerIds = contributors
      .filter(
        (player) =>
          player.status !== 'FOLDED' && player.status !== 'SITTING_OUT',
      )
      .map((player) => player.playerId)
    if (amount > 0) {
      if (eligiblePlayerIds.length === 0) {
        throw new PokerRuleError(
          'INVARIANT_VIOLATION',
          'Contribution tier has no eligible player',
        )
      }
      pots.push({ amount, eligiblePlayerIds })
    }
    previousLevel = level
  }
  return pots
}

function winnerOrder(
  players: readonly ShowdownPlayer[],
  winnerIds: readonly PlayerId[],
  buttonSeat: number,
): PlayerId[] {
  const winnerSet = new Set(winnerIds)
  const sorted = [...players].toSorted((left, right) => left.seat - right.seat)
  return [
    ...sorted.filter((player) => player.seat > buttonSeat),
    ...sorted.filter((player) => player.seat <= buttonSeat),
  ]
    .filter((player) => winnerSet.has(player.playerId))
    .map((player) => player.playerId)
}

function validateRunoutCards(
  boards: readonly (readonly Card[])[],
  players: readonly ShowdownPlayer[],
): void {
  if (boards.length < 1 || boards.length > 2) {
    throw new PokerRuleError(
      'INVALID_TABLE',
      'Showdown supports one or two runouts',
    )
  }
  if (boards.some((board) => board.length !== 5)) {
    throw new PokerRuleError(
      'INVALID_CARD',
      'Every showdown runout requires five board cards',
    )
  }
  let sharedPrefixLength = 0
  while (
    sharedPrefixLength < 5 &&
    boards.every(
      (board) => board[sharedPrefixLength] === boards[0]![sharedPrefixLength],
    )
  ) {
    sharedPrefixLength += 1
  }
  assertUniqueCards([
    ...boards[0]!.slice(0, sharedPrefixLength),
    ...boards.flatMap((board) => board.slice(sharedPrefixLength)),
    ...players.flatMap((player) => player.holeCards),
  ])
}

function evaluateRunout(
  board: readonly Card[],
  players: readonly ShowdownPlayer[],
): Readonly<Record<PlayerId, EvaluatedHand>> {
  return Object.fromEntries(
    players
      .filter(
        (player) =>
          player.status !== 'FOLDED' && player.status !== 'SITTING_OUT',
      )
      .map((player) => {
        if (player.holeCards.length !== 2) {
          throw new PokerRuleError(
            'INVALID_CARD',
            'Every showdown player must have two hole cards',
          )
        }
        return [
          player.playerId,
          evaluateBestHand([...player.holeCards, ...board]),
        ]
      }),
  )
}

function winnersForPot(
  pot: SidePot,
  hands: Readonly<Record<PlayerId, EvaluatedHand>>,
): PlayerId[] {
  let winnerIds: PlayerId[] = []
  let winningHand: EvaluatedHand | undefined
  for (const playerId of pot.eligiblePlayerIds) {
    const hand = hands[playerId]
    if (hand === undefined) continue
    if (
      winningHand === undefined ||
      compareEvaluatedHands(hand, winningHand) > 0
    ) {
      winningHand = hand
      winnerIds = [playerId]
    } else if (compareEvaluatedHands(hand, winningHand) === 0) {
      winnerIds.push(playerId)
    }
  }
  if (winnerIds.length === 0) {
    throw new PokerRuleError(
      'INVARIANT_VIOLATION',
      'A side pot has no eligible winner',
    )
  }
  return winnerIds
}

function awardAmount(
  payouts: Record<PlayerId, Chips>,
  amount: Chips,
  orderedWinners: readonly PlayerId[],
): void {
  const equalShare = Math.floor(amount / orderedWinners.length)
  let oddChips = amount % orderedWinners.length
  for (const playerId of orderedWinners) {
    payouts[playerId] = (payouts[playerId] ?? 0) + equalShare
    if (oddChips > 0) {
      payouts[playerId] += 1
      oddChips -= 1
    }
  }
}

export function determineMultiRunoutSettlement(input: {
  boards: readonly (readonly Card[])[]
  buttonSeat: number
  players: readonly ShowdownPlayer[]
}): MultiRunoutSettlement {
  validateRunoutCards(input.boards, input.players)
  const eligiblePlayers = input.players.filter(
    (player) => player.status !== 'FOLDED' && player.status !== 'SITTING_OUT',
  )
  if (eligiblePlayers.length < 2) {
    throw new PokerRuleError(
      'INVARIANT_VIOLATION',
      'Showdown requires at least two eligible players',
    )
  }

  const runouts = input.boards.map((board) => ({
    board,
    hands: evaluateRunout(board, input.players),
    pots: [] as SidePotResult[],
  }))
  const payouts: Record<PlayerId, Chips> = Object.fromEntries(
    input.players.map((player) => [player.playerId, 0]),
  )

  for (const pot of buildSidePots(input.players)) {
    if (pot.eligiblePlayerIds.length === 1) {
      const winnerId = pot.eligiblePlayerIds[0]!
      payouts[winnerId] = (payouts[winnerId] ?? 0) + pot.amount
      runouts[0]!.pots.push({
        amount: pot.amount,
        eligiblePlayerIds: pot.eligiblePlayerIds,
        winnerPlayerIds: [winnerId],
      })
      continue
    }

    const baseShare = Math.floor(pot.amount / runouts.length)
    let runoutOddChips = pot.amount % runouts.length
    for (const runout of runouts) {
      const amount = baseShare + (runoutOddChips > 0 ? 1 : 0)
      if (runoutOddChips > 0) runoutOddChips -= 1
      const winnerIds = winnersForPot(pot, runout.hands)
      const orderedWinners = winnerOrder(
        input.players,
        winnerIds,
        input.buttonSeat,
      )
      awardAmount(payouts, amount, orderedWinners)
      runout.pots.push({
        amount,
        eligiblePlayerIds: pot.eligiblePlayerIds,
        winnerPlayerIds: orderedWinners,
      })
    }
  }

  return { payouts, runouts }
}

export function determineShowdownSettlement(input: {
  board: readonly Card[]
  buttonSeat: number
  players: readonly ShowdownPlayer[]
}): ShowdownSettlement {
  const settlement = determineMultiRunoutSettlement({
    boards: [input.board],
    buttonSeat: input.buttonSeat,
    players: input.players,
  })
  const runout = settlement.runouts[0]!
  return {
    payouts: settlement.payouts,
    hands: runout.hands,
    pots: runout.pots,
  }
}
