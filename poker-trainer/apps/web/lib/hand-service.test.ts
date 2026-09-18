import { SessionStateError } from '@poker-trainer/database'
import type { GameRepository } from '@poker-trainer/database'
import { startPokerHand } from '@poker-trainer/poker-engine'
import { describe, expect, it, vi } from 'vitest'
import { HandService } from './hand-service'

type HandRecord = NonNullable<Awaited<ReturnType<GameRepository['findHand']>>>
type SessionRecord = NonNullable<
  Awaited<ReturnType<GameRepository['findSession']>>
>

const players = [
  { seat: 1, playerId: 'hero', stack: 2_000 },
  { seat: 2, playerId: 'jl', stack: 2_000 },
]

function participants(ending: boolean) {
  return players.map((entry) => ({
    id: `participant-${entry.playerId}`,
    handId: ending ? 'hand-1' : 'hand-2',
    playerId: entry.playerId,
    profileVersionId: `profile-${entry.playerId}`,
    seatNo: entry.seat,
    startingStack: entry.stack,
    endingStack: ending ? entry.stack : null,
    holeCards: null,
    player: {
      id: entry.playerId,
      code: entry.playerId,
      displayName: entry.playerId === 'hero' ? 'Hero' : 'JL',
      kind:
        entry.playerId === 'hero' ? ('HERO' as const) : ('OPPONENT' as const),
      enabled: true,
      metadata: null,
      activeProfileVersionId: `profile-${entry.playerId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    profileVersion: {
      id: `profile-${entry.playerId}`,
      playerId: entry.playerId,
      version: 1,
      profile: {},
      source: 'test',
      createdAt: new Date(),
    },
  }))
}

function handRecord(
  handNo: number,
  status: 'ACTIVE' | 'COMPLETED',
): HandRecord {
  const state = startPokerHand({
    seed: `hand-${handNo}-seed`,
    buttonSeat: handNo === 1 ? 1 : 2,
    smallBlind: 10,
    bigBlind: 20,
    players,
  })
  return {
    id: `hand-${handNo}`,
    sessionId: 'session-1',
    handNo,
    status,
    seedHash: 'hash',
    version: 1,
    buttonSeat: state.dealt.buttonSeat,
    state: JSON.parse(JSON.stringify(state)) as object,
    result: null,
    stateHash: 'state-hash',
    startedAt: new Date(),
    completedAt: status === 'COMPLETED' ? new Date() : null,
    participants: participants(status === 'COMPLETED'),
    events: [
      {
        id: `event-${handNo}`,
        handId: `hand-${handNo}`,
        sequenceNo: 1,
        eventType: 'HAND_STARTED',
        actorId: null,
        commandId: null,
        payload: {},
        createdAt: new Date(),
      },
    ],
  } as unknown as HandRecord
}

function sessionRecord(): SessionRecord {
  return {
    id: 'session-1',
    tableSize: 2,
    smallBlind: 10,
    bigBlind: 20,
    startingStack: 2_000,
    status: 'ACTIVE',
    config: null,
    startedAt: new Date(),
    endedAt: null,
    participants: players.map((entry) => ({
      id: `session-player-${entry.playerId}`,
      sessionId: 'session-1',
      playerId: entry.playerId,
      seatNo: entry.seat,
      stack: entry.stack,
      state: null,
      player: {
        ...participants(false).find(
          (participant) => participant.playerId === entry.playerId,
        )!.player,
        activeProfileVersion: null,
      },
    })),
    hands: [],
  } as unknown as SessionRecord
}

describe('hand service recovery', () => {
  it('restores an existing next hand after a repeated request', async () => {
    const previous = handRecord(1, 'COMPLETED')
    const successor = handRecord(2, 'ACTIVE')
    const createHand = vi.fn()
    const repository = {
      findHand: vi.fn().mockResolvedValue(previous),
      findHandByNumber: vi.fn().mockResolvedValue(successor),
      createHand,
    } as unknown as GameRepository

    const result = await new HandService(repository).createNext('hand-1', {
      randomizeSeats: false,
    })

    expect(result.id).toBe('hand-2')
    expect(result.handNo).toBe(2)
    expect(createHand).not.toHaveBeenCalled()
  })

  it('returns the winning hand after a concurrent creation conflict', async () => {
    const previous = handRecord(1, 'COMPLETED')
    const successor = handRecord(2, 'ACTIVE')
    const findHandByNumber = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(successor)
    const createHand = vi
      .fn()
      .mockRejectedValue(
        new SessionStateError('Another request created the next hand'),
      )
    const repository = {
      findHand: vi.fn().mockResolvedValue(previous),
      findHandByNumber,
      findSession: vi.fn().mockResolvedValue(sessionRecord()),
      createHand,
    } as unknown as GameRepository

    const result = await new HandService(repository).createNext('hand-1', {
      randomizeSeats: true,
    })

    expect(result.id).toBe('hand-2')
    expect(findHandByNumber).toHaveBeenCalledTimes(3)
    expect(createHand).toHaveBeenCalledTimes(1)
  })
})
