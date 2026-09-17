import type {
  Card,
  Chips,
  PlayerId,
  PlayerStatus,
  Street,
} from '@poker-trainer/domain'
import { assertUniqueCards, createStandardDeck } from './cards'
import { PokerRuleError } from './errors'
import { deriveSeed, shuffleWithSeed } from './rng'

export interface TablePlayerInput {
  readonly seat: number
  readonly playerId: PlayerId
  readonly stack: Chips
  readonly sittingOut?: boolean
}

export interface HandSeat {
  readonly seat: number
  readonly playerId: PlayerId
  readonly stack: Chips
  readonly startingStack: Chips
  readonly status: PlayerStatus
  readonly holeCards: readonly Card[]
  readonly committedThisStreet: Chips
  readonly committedThisHand: Chips
}

export interface DealtHandState {
  readonly seed: string
  readonly buttonSeat: number
  readonly smallBlindSeat: number
  readonly bigBlindSeat: number
  readonly firstToActPreflop: number | null
  readonly firstToActPostflop: number | null
  readonly smallBlind: Chips
  readonly bigBlind: Chips
  readonly street: Street
  readonly board: readonly Card[]
  readonly burnCards: readonly Card[]
  readonly deck: readonly Card[]
  readonly seats: readonly HandSeat[]
}

export interface StartHandInput {
  readonly seed: string
  readonly buttonSeat: number
  readonly smallBlind: Chips
  readonly bigBlind: Chips
  readonly players: readonly TablePlayerInput[]
}

export function randomizeTableSeats(
  players: readonly TablePlayerInput[],
  seed: string,
): TablePlayerInput[] {
  if (players.length < 2) return [...players]
  const seats = players.map((player) => player.seat).toSorted((a, b) => a - b)
  let shuffled = shuffleWithSeed(players, deriveSeed(seed, 'seating'))
  const unchanged = shuffled.every(
    (player, index) => player.playerId === players[index]?.playerId,
  )
  if (unchanged) shuffled = [...shuffled.slice(1), shuffled[0]!]
  return shuffled
    .map((player, index) => ({ ...player, seat: seats[index]! }))
    .toSorted((left, right) => left.seat - right.seat)
}

function assertChips(value: number, field: string, allowZero = true): void {
  const validMinimum = allowZero ? value >= 0 : value > 0
  if (!Number.isSafeInteger(value) || !validMinimum) {
    throw new PokerRuleError(
      'INVALID_CHIPS',
      `${field} must be a valid integer chip amount`,
    )
  }
}

function orderedActiveSeats(players: readonly TablePlayerInput[]): number[] {
  return players
    .filter((player) => !player.sittingOut && player.stack > 0)
    .map((player) => player.seat)
    .toSorted((left, right) => left - right)
}

export function nextSeat(seats: readonly number[], fromSeat: number): number {
  const sorted = [...seats].toSorted((left, right) => left - right)
  const next = sorted.find((seat) => seat > fromSeat) ?? sorted[0]
  if (next === undefined) {
    throw new PokerRuleError('INVALID_TABLE', 'No active seat is available')
  }
  return next
}

function nextSeatThatCanAct(
  seats: readonly HandSeat[],
  fromSeat: number,
): number | null {
  const candidates = seats
    .filter((seat) => seat.status === 'ACTIVE')
    .map((seat) => seat.seat)
  return candidates.length === 0 ? null : nextSeat(candidates, fromSeat)
}

function postBlind(seat: HandSeat, blind: Chips): HandSeat {
  const amount = Math.min(blind, seat.stack)
  const stack = seat.stack - amount
  return {
    ...seat,
    stack,
    status: stack === 0 ? 'ALL_IN' : seat.status,
    committedThisStreet: amount,
    committedThisHand: amount,
  }
}

export function startHand(input: StartHandInput): DealtHandState {
  assertChips(input.smallBlind, 'smallBlind', false)
  assertChips(input.bigBlind, 'bigBlind', false)
  if (input.smallBlind >= input.bigBlind) {
    throw new PokerRuleError(
      'INVALID_TABLE',
      'Small blind must be lower than big blind',
    )
  }
  if (input.players.length < 2 || input.players.length > 6) {
    throw new PokerRuleError(
      'INVALID_TABLE',
      'A hand requires between 2 and 6 seats',
    )
  }

  const seatIds = new Set<number>()
  const playerIds = new Set<PlayerId>()
  for (const player of input.players) {
    assertChips(player.stack, `stack for ${player.playerId}`)
    if (!Number.isSafeInteger(player.seat) || player.seat < 0) {
      throw new PokerRuleError(
        'INVALID_TABLE',
        'Seat numbers must be non-negative integers',
      )
    }
    if (seatIds.has(player.seat) || playerIds.has(player.playerId)) {
      throw new PokerRuleError(
        'INVALID_TABLE',
        'Seats and player ids must be unique',
      )
    }
    seatIds.add(player.seat)
    playerIds.add(player.playerId)
  }

  const activeSeats = orderedActiveSeats(input.players)
  if (activeSeats.length < 2 || !activeSeats.includes(input.buttonSeat)) {
    throw new PokerRuleError(
      'INVALID_TABLE',
      'Button must identify an active player',
    )
  }

  const headsUp = activeSeats.length === 2
  const smallBlindSeat = headsUp
    ? input.buttonSeat
    : nextSeat(activeSeats, input.buttonSeat)
  const bigBlindSeat = nextSeat(activeSeats, smallBlindSeat)
  const deck = shuffleWithSeed(
    createStandardDeck(),
    deriveSeed(input.seed, 'deck'),
  )
  const mutableDeck = [...deck]

  let seats: HandSeat[] = input.players.map((player) => ({
    seat: player.seat,
    playerId: player.playerId,
    stack: player.stack,
    startingStack: player.stack,
    status: player.sittingOut || player.stack === 0 ? 'SITTING_OUT' : 'ACTIVE',
    holeCards: [],
    committedThisStreet: 0,
    committedThisHand: 0,
  }))

  seats = seats.map((seat) => {
    if (seat.seat === smallBlindSeat) return postBlind(seat, input.smallBlind)
    if (seat.seat === bigBlindSeat) return postBlind(seat, input.bigBlind)
    return seat
  })

  const dealOrder: number[] = []
  let cursor = input.buttonSeat
  for (let index = 0; index < activeSeats.length; index += 1) {
    cursor = nextSeat(activeSeats, cursor)
    dealOrder.push(cursor)
  }

  for (let round = 0; round < 2; round += 1) {
    for (const seatNo of dealOrder) {
      const card = mutableDeck.shift()
      if (card === undefined) {
        throw new PokerRuleError(
          'INVARIANT_VIOLATION',
          'Deck exhausted while dealing',
        )
      }
      seats = seats.map((seat) =>
        seat.seat === seatNo
          ? { ...seat, holeCards: [...seat.holeCards, card] }
          : seat,
      )
    }
  }

  const firstToActPreflop = nextSeatThatCanAct(seats, bigBlindSeat)
  const firstToActPostflop = nextSeatThatCanAct(seats, input.buttonSeat)
  const allCards = [...seats.flatMap((seat) => seat.holeCards), ...mutableDeck]
  assertUniqueCards(allCards)

  return {
    seed: input.seed,
    buttonSeat: input.buttonSeat,
    smallBlindSeat,
    bigBlindSeat,
    firstToActPreflop,
    firstToActPostflop,
    smallBlind: input.smallBlind,
    bigBlind: input.bigBlind,
    street: 'PREFLOP',
    board: [],
    burnCards: [],
    deck: mutableDeck,
    seats: seats.toSorted((left, right) => left.seat - right.seat),
  }
}

export function dealNextStreet(hand: DealtHandState): DealtHandState {
  const dealCounts: Partial<Record<Street, { next: Street; cards: number }>> = {
    PREFLOP: { next: 'FLOP', cards: 3 },
    FLOP: { next: 'TURN', cards: 1 },
    TURN: { next: 'RIVER', cards: 1 },
  }
  const deal = dealCounts[hand.street]
  if (deal === undefined) {
    throw new PokerRuleError(
      'ILLEGAL_ACTION',
      `Cannot deal after ${hand.street}`,
    )
  }

  const deck = [...hand.deck]
  const burn = deck.shift()
  if (burn === undefined || deck.length < deal.cards) {
    throw new PokerRuleError(
      'INVARIANT_VIOLATION',
      'Deck exhausted while dealing board',
    )
  }
  const boardCards = deck.splice(0, deal.cards)
  const result: DealtHandState = {
    ...hand,
    street: deal.next,
    board: [...hand.board, ...boardCards],
    burnCards: [...hand.burnCards, burn],
    deck,
  }
  assertUniqueCards([
    ...result.seats.flatMap((seat) => seat.holeCards),
    ...result.board,
    ...result.burnCards,
    ...result.deck,
  ])
  return result
}
