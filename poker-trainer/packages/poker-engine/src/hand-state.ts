import type {
  Card,
  Chips,
  LegalActionSet,
  PlayerAction,
  PlayerId,
  PlayerStatus,
  Street,
} from '@poker-trainer/domain'
import {
  applyBettingAction,
  createBettingRound,
  getLegalActions,
  type BettingPlayer,
  type BettingRoundState,
} from './betting'
import {
  dealNextStreet,
  nextSeat,
  startHand,
  type DealtHandState,
  type StartHandInput,
} from './table'
import { determineMultiRunoutSettlement, type SidePotResult } from './showdown'

export type PokerHandPhase = 'BETTING' | 'SHOWDOWN' | 'COMPLETE'

export type PokerHandResult =
  | {
      readonly reason: 'ALL_OTHERS_FOLDED'
      readonly winnerPlayerId: PlayerId
      readonly potAwarded: Chips
    }
  | {
      readonly reason: 'SHOWDOWN'
      readonly payouts: Readonly<Record<PlayerId, Chips>>
      readonly runouts: readonly {
        readonly board: readonly Card[]
        readonly pots: readonly SidePotResult[]
        readonly hands: Readonly<
          Record<
            PlayerId,
            {
              readonly category: string
              readonly tiebreak: readonly number[]
              readonly cards: readonly Card[]
            }
          >
        >
      }[]
    }

export interface PokerHandState {
  readonly schemaVersion: 1
  readonly phase: PokerHandPhase
  readonly dealt: DealtHandState
  readonly betting: BettingRoundState
  readonly pot: Chips
  readonly allInRunoutCount: 1 | 2
  readonly runoutBoards: readonly (readonly Card[])[]
  readonly result: PokerHandResult | null
}

export interface StartPokerHandInput extends StartHandInput {
  readonly allInRunoutCount?: 1 | 2
}

export interface ActorSeatView {
  readonly seat: number
  readonly playerId: PlayerId
  readonly stack: Chips
  readonly status: PlayerStatus
  readonly committedThisStreet: Chips
  readonly committedThisHand: Chips
  readonly holeCards: readonly Card[] | null
}

export interface PokerActorView {
  readonly schemaVersion: 1
  readonly phase: PokerHandPhase
  readonly street: Street
  readonly buttonSeat: number
  readonly smallBlindSeat: number
  readonly bigBlindSeat: number
  readonly board: readonly Card[]
  readonly runoutBoards: readonly (readonly Card[])[]
  readonly pot: Chips
  readonly currentBet: Chips
  readonly currentActorPlayerId: PlayerId | null
  readonly seats: readonly ActorSeatView[]
  readonly legalActions: LegalActionSet | null
  readonly result: PokerHandResult | null
}

function bettingPlayers(dealt: DealtHandState): BettingPlayer[] {
  return dealt.seats.map((seat) => ({
    seat: seat.seat,
    playerId: seat.playerId,
    stack: seat.stack,
    status: seat.status,
    streetContribution: seat.committedThisStreet,
    totalContribution: seat.committedThisHand,
  }))
}

function syncDealtWithBetting(
  dealt: DealtHandState,
  betting: BettingRoundState,
): DealtHandState {
  return {
    ...dealt,
    seats: dealt.seats.map((seat) => {
      const player = betting.players.find(
        (candidate) => candidate.seat === seat.seat,
      )
      if (player === undefined) return seat
      return {
        ...seat,
        stack: player.stack,
        status: player.status,
        committedThisStreet: player.streetContribution,
        committedThisHand: player.totalContribution,
      }
    }),
  }
}

function potFrom(betting: BettingRoundState): Chips {
  return betting.players.reduce(
    (total, player) => total + player.totalContribution,
    0,
  )
}

function firstActiveAfterButton(dealt: DealtHandState): number | null {
  const activeSeats = dealt.seats
    .filter((seat) => seat.status === 'ACTIVE')
    .map((seat) => seat.seat)
  return activeSeats.length === 0
    ? null
    : nextSeat(activeSeats, dealt.buttonSeat)
}

function resetStreetContributions(dealt: DealtHandState): DealtHandState {
  return {
    ...dealt,
    seats: dealt.seats.map((seat) => ({
      ...seat,
      committedThisStreet: 0,
    })),
  }
}

function completedBettingState(dealt: DealtHandState): BettingRoundState {
  return createBettingRound({
    bigBlind: dealt.bigBlind,
    players: bettingPlayers(dealt),
    firstToActSeat: null,
  })
}

function dealToRiver(dealtInput: DealtHandState): DealtHandState {
  let dealt = dealtInput
  while (dealt.street !== 'RIVER') dealt = dealNextStreet(dealt)
  return dealt
}

function dealTwoRunouts(dealt: DealtHandState): {
  dealt: DealtHandState
  boards: readonly (readonly Card[])[]
} {
  const originalBurnCount = dealt.burnCards.length
  const first = dealToRiver(dealt)
  const second = dealToRiver({ ...dealt, deck: first.deck })
  return {
    dealt: {
      ...first,
      deck: second.deck,
      burnCards: [
        ...dealt.burnCards,
        ...first.burnCards.slice(originalBurnCount),
        ...second.burnCards.slice(originalBurnCount),
      ],
    },
    boards: [first.board, second.board],
  }
}

function settleShowdown(
  dealtInput: DealtHandState,
  bettingInput: BettingRoundState,
  boards: readonly (readonly Card[])[],
  allInRunoutCount: 1 | 2,
): PokerHandState {
  const dealt = syncDealtWithBetting(dealtInput, bettingInput)
  const settlement = determineMultiRunoutSettlement({
    boards,
    buttonSeat: dealt.buttonSeat,
    players: dealt.seats.map((seat) => ({
      seat: seat.seat,
      playerId: seat.playerId,
      status: seat.status,
      totalContribution: seat.committedThisHand,
      holeCards: seat.holeCards,
    })),
  })
  const settledDealt: DealtHandState = {
    ...dealt,
    street: 'SHOWDOWN',
    seats: dealt.seats.map((seat) => ({
      ...seat,
      stack: seat.stack + (settlement.payouts[seat.playerId] ?? 0),
      committedThisStreet: 0,
      committedThisHand: 0,
    })),
  }
  return {
    schemaVersion: 1,
    phase: 'COMPLETE',
    dealt: settledDealt,
    betting: completedBettingState(settledDealt),
    pot: 0,
    allInRunoutCount,
    runoutBoards: boards,
    result: {
      reason: 'SHOWDOWN',
      payouts: settlement.payouts,
      runouts: settlement.runouts.map((runout) => ({
        board: runout.board,
        pots: runout.pots,
        hands: Object.fromEntries(
          Object.entries(runout.hands).map(([playerId, hand]) => [
            playerId,
            {
              category: hand.category,
              tiebreak: hand.tiebreak,
              cards: hand.cards,
            },
          ]),
        ),
      })),
    },
  }
}

function advanceAfterRound(
  dealtInput: DealtHandState,
  bettingInput: BettingRoundState,
  allInRunoutCount: 1 | 2,
): PokerHandState {
  let dealt = syncDealtWithBetting(dealtInput, bettingInput)
  const pot = potFrom(bettingInput)

  if (bettingInput.status === 'HAND_COMPLETE') {
    const winner = dealt.seats.find(
      (seat) => seat.status !== 'FOLDED' && seat.status !== 'SITTING_OUT',
    )
    if (winner === undefined) throw new Error('Hand completed without a winner')
    dealt = {
      ...dealt,
      seats: dealt.seats.map((seat) =>
        seat.seat === winner.seat
          ? {
              ...seat,
              stack: seat.stack + pot,
              committedThisStreet: 0,
              committedThisHand: 0,
            }
          : { ...seat, committedThisStreet: 0, committedThisHand: 0 },
      ),
    }
    return {
      schemaVersion: 1,
      phase: 'COMPLETE',
      dealt,
      betting: completedBettingState(dealt),
      pot: 0,
      allInRunoutCount,
      runoutBoards: [],
      result: {
        reason: 'ALL_OTHERS_FOLDED',
        winnerPlayerId: winner.playerId,
        potAwarded: pot,
      },
    }
  }

  const remainingPlayers = dealt.seats.filter(
    (seat) => seat.status !== 'FOLDED' && seat.status !== 'SITTING_OUT',
  )
  const shouldRunTwice =
    allInRunoutCount === 2 &&
    dealt.street !== 'RIVER' &&
    remainingPlayers.length === 2 &&
    remainingPlayers.every((seat) => seat.status === 'ALL_IN')
  if (shouldRunTwice) {
    const runouts = dealTwoRunouts(dealt)
    const showdownBetting = createBettingRound({
      bigBlind: runouts.dealt.bigBlind,
      players: bettingPlayers(runouts.dealt),
      firstToActSeat: null,
    })
    return settleShowdown(
      runouts.dealt,
      showdownBetting,
      runouts.boards,
      allInRunoutCount,
    )
  }

  let nextDealt = dealt
  while (nextDealt.street !== 'RIVER') {
    nextDealt = resetStreetContributions(dealNextStreet(nextDealt))
    const firstToActSeat = firstActiveAfterButton(nextDealt)
    const activeCount = nextDealt.seats.filter(
      (seat) => seat.status === 'ACTIVE',
    ).length
    if (activeCount >= 2 && firstToActSeat !== null) {
      const nextBetting = createBettingRound({
        bigBlind: nextDealt.bigBlind,
        players: bettingPlayers(nextDealt),
        firstToActSeat,
      })
      return {
        schemaVersion: 1,
        phase: 'BETTING',
        dealt: nextDealt,
        betting: nextBetting,
        pot,
        allInRunoutCount,
        runoutBoards: [],
        result: null,
      }
    }
  }

  const showdownBetting = createBettingRound({
    bigBlind: nextDealt.bigBlind,
    players: bettingPlayers(nextDealt),
    firstToActSeat: null,
  })
  return settleShowdown(
    nextDealt,
    showdownBetting,
    [nextDealt.board],
    allInRunoutCount,
  )
}

export function startPokerHand(input: StartPokerHandInput): PokerHandState {
  const dealt = startHand(input)
  const betting = createBettingRound({
    bigBlind: input.bigBlind,
    players: bettingPlayers(dealt),
    firstToActSeat: dealt.firstToActPreflop,
    lastFullRaiseSize: input.bigBlind,
    lastFullAggressorSeat: dealt.bigBlindSeat,
  })
  const state: PokerHandState = {
    schemaVersion: 1,
    phase: betting.status === 'OPEN' ? 'BETTING' : 'SHOWDOWN',
    dealt,
    betting,
    pot: potFrom(betting),
    allInRunoutCount: input.allInRunoutCount ?? 2,
    runoutBoards: [],
    result: null,
  }
  return betting.status === 'OPEN'
    ? state
    : advanceAfterRound(dealt, betting, state.allInRunoutCount)
}

export function applyPokerAction(
  state: PokerHandState,
  actorPlayerId: PlayerId,
  action: PlayerAction,
): PokerHandState {
  const actor = state.betting.players.find(
    (player) => player.playerId === actorPlayerId,
  )
  if (actor === undefined) throw new Error('Actor is not seated in this hand')
  const betting = applyBettingAction(state.betting, actor.seat, action)
  if (betting.status === 'OPEN') {
    return {
      ...state,
      dealt: syncDealtWithBetting(state.dealt, betting),
      betting,
      pot: potFrom(betting),
    }
  }
  return advanceAfterRound(state.dealt, betting, state.allInRunoutCount)
}

export function createActorView(
  state: PokerHandState,
  actorPlayerId: PlayerId,
): PokerActorView {
  const currentActor = state.betting.players.find(
    (player) => player.seat === state.betting.currentActorSeat,
  )
  const actor = state.betting.players.find(
    (player) => player.playerId === actorPlayerId,
  )
  const legalActions =
    state.phase === 'BETTING' &&
    actor !== undefined &&
    actor.seat === state.betting.currentActorSeat
      ? getLegalActions(state.betting, actor.seat)
      : null

  return {
    schemaVersion: 1,
    phase: state.phase,
    street: state.dealt.street,
    buttonSeat: state.dealt.buttonSeat,
    smallBlindSeat: state.dealt.smallBlindSeat,
    bigBlindSeat: state.dealt.bigBlindSeat,
    board: state.dealt.board,
    runoutBoards: state.runoutBoards,
    pot: state.pot,
    currentBet: state.betting.currentBet,
    currentActorPlayerId: currentActor?.playerId ?? null,
    seats: state.dealt.seats.map((seat) => ({
      seat: seat.seat,
      playerId: seat.playerId,
      stack: seat.stack,
      status: seat.status,
      committedThisStreet: seat.committedThisStreet,
      committedThisHand: seat.committedThisHand,
      holeCards: seat.playerId === actorPlayerId ? seat.holeCards : null,
    })),
    legalActions,
    result: state.result,
  }
}
