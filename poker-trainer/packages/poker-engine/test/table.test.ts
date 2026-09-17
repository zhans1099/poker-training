import { describe, expect, it } from 'vitest'
import { dealNextStreet, startHand } from '../src/index.js'

function players(count: number) {
  return Array.from({ length: count }, (_, seat) => ({
    seat,
    playerId: seat === 0 ? 'Hero' : `P${seat}`,
    stack: 2_000,
  }))
}

describe('table setup and dealing', () => {
  it('assigns blinds and action order at a six-handed table', () => {
    const hand = startHand({
      seed: 'six-handed',
      buttonSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      players: players(6),
    })

    expect(hand.smallBlindSeat).toBe(1)
    expect(hand.bigBlindSeat).toBe(2)
    expect(hand.firstToActPreflop).toBe(3)
    expect(hand.firstToActPostflop).toBe(1)
    expect(hand.deck).toHaveLength(40)
    expect(hand.seats.every((seat) => seat.holeCards.length === 2)).toBe(true)
    expect(hand.seats.find((seat) => seat.seat === 1)?.stack).toBe(1_990)
    expect(hand.seats.find((seat) => seat.seat === 2)?.stack).toBe(1_980)
  })

  it('uses heads-up button/small-blind action rules', () => {
    const hand = startHand({
      seed: 'heads-up',
      buttonSeat: 4,
      smallBlind: 10,
      bigBlind: 20,
      players: [
        { seat: 1, playerId: 'Villain', stack: 2_000 },
        { seat: 4, playerId: 'Hero', stack: 2_000 },
      ],
    })

    expect(hand.smallBlindSeat).toBe(4)
    expect(hand.bigBlindSeat).toBe(1)
    expect(hand.firstToActPreflop).toBe(4)
    expect(hand.firstToActPostflop).toBe(1)
  })

  it('burns and deals a unique five-card board', () => {
    const preflop = startHand({
      seed: 'complete-board',
      buttonSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      players: players(6),
    })
    const flop = dealNextStreet(preflop)
    const turn = dealNextStreet(flop)
    const river = dealNextStreet(turn)

    expect(flop.street).toBe('FLOP')
    expect(flop.board).toHaveLength(3)
    expect(turn.street).toBe('TURN')
    expect(turn.board).toHaveLength(4)
    expect(river.street).toBe('RIVER')
    expect(river.board).toHaveLength(5)
    expect(river.burnCards).toHaveLength(3)
    expect(river.deck).toHaveLength(32)
    expect(
      new Set([
        ...river.seats.flatMap((seat) => seat.holeCards),
        ...river.board,
        ...river.burnCards,
        ...river.deck,
      ]),
    ).toHaveLength(52)
  })

  it('posts a blind all-in without producing a negative stack', () => {
    const hand = startHand({
      seed: 'short-blind',
      buttonSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      players: [
        { seat: 0, playerId: 'Hero', stack: 2_000 },
        { seat: 1, playerId: 'Short', stack: 6 },
        { seat: 2, playerId: 'Deep', stack: 2_000 },
      ],
    })
    const short = hand.seats.find((seat) => seat.playerId === 'Short')
    expect(short?.stack).toBe(0)
    expect(short?.committedThisStreet).toBe(6)
    expect(short?.status).toBe('ALL_IN')
  })
})
