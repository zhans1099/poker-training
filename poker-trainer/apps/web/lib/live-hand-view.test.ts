import type { HeroHandView } from '@poker-trainer/schemas'
import { describe, expect, it } from 'vitest'
import { liveActions, liveSeats, toCardData } from './live-hand-view'

const hand = {
  id: 'hand-1',
  sessionId: 'session-1',
  handNo: 7,
  status: 'ACTIVE',
  version: 4,
  stateHash: 'hash',
  startedAt: '2026-09-17T00:00:00.000Z',
  completedAt: null,
  players: [
    {
      playerId: 'jl',
      displayName: 'JL',
      kind: 'OPPONENT',
      seatNo: 1,
      profileVersion: 2,
    },
    {
      playerId: 'hero',
      displayName: 'Hero',
      kind: 'HERO',
      seatNo: 3,
      profileVersion: 1,
    },
    {
      playerId: 'jj',
      displayName: 'JJ',
      kind: 'OPPONENT',
      seatNo: 5,
      profileVersion: 3,
    },
  ],
  events: [
    {
      id: 'event-1',
      sequenceNo: 2,
      eventType: 'PLAYER_ACTION',
      actorId: 'jl',
      createdAt: '2026-09-17T00:01:00.000Z',
      payload: {
        action: { type: 'RAISE', to: 120 },
        streetBefore: 'PREFLOP',
      },
    },
  ],
  view: {
    schemaVersion: 1,
    phase: 'BETTING',
    street: 'PREFLOP',
    buttonSeat: 5,
    smallBlindSeat: 1,
    bigBlindSeat: 3,
    board: [],
    runoutBoards: [],
    pot: 180,
    currentBet: 120,
    currentActorPlayerId: 'hero',
    seats: [
      {
        seat: 1,
        playerId: 'jl',
        stack: 1880,
        status: 'ACTIVE',
        committedThisStreet: 120,
        committedThisHand: 120,
        holeCards: null,
      },
      {
        seat: 3,
        playerId: 'hero',
        stack: 1980,
        status: 'ACTIVE',
        committedThisStreet: 20,
        committedThisHand: 20,
        holeCards: ['Kh', 'Qh'],
      },
      {
        seat: 5,
        playerId: 'jj',
        stack: 1960,
        status: 'ACTIVE',
        committedThisStreet: 40,
        committedThisHand: 40,
        holeCards: null,
      },
    ],
    legalActions: {
      canFold: true,
      canCheck: false,
      callAmount: 100,
      callTo: 120,
      canCall: true,
      canBet: false,
      canRaise: true,
      canAllIn: true,
      minBetTo: null,
      minRaiseTo: 240,
      maxTo: 2000,
      raiseRightsOpen: true,
    },
    result: null,
  },
} satisfies HeroHandView

describe('live hand UI projection', () => {
  it('rotates the table so Hero remains at the bottom', () => {
    const seats = liveSeats(hand)
    expect(seats[0]).toMatchObject({ id: 'hero', name: 'Hero', hero: true })
    expect(seats.find((seat) => seat.name === 'JL')).toMatchObject({
      status: 'SB',
    })
    expect(seats.find((seat) => seat.name === 'JJ')).toMatchObject({
      status: 'D',
    })
  })

  it('converts public actions into timeline entries', () => {
    expect(liveActions(hand)).toEqual([
      {
        id: 'event-1',
        actor: 'JL',
        action: '加注到',
        amount: 120,
        street: '翻牌前',
        tone: 'raise',
      },
    ])
  })

  it('converts engine card codes into rendered cards', () => {
    expect(toCardData('Kh')).toEqual({ rank: 'K', suit: 'heart' })
  })

  it('does not mark the stale last actor as active after completion', () => {
    const completed = {
      ...hand,
      status: 'COMPLETED',
      completedAt: '2026-09-17T00:03:00.000Z',
      view: { ...hand.view, phase: 'COMPLETE' },
    } satisfies HeroHandView

    expect(liveSeats(completed).some((seat) => seat.active)).toBe(false)
  })
})
