import { describe, expect, it } from 'vitest'
import { toPublicHandEvent } from './public-hand-event'

describe('public hand event projection', () => {
  it('keeps timeline fields while stripping private and unknown data', () => {
    const projected = toPublicHandEvent({
      id: 'event-1',
      sequenceNo: 2,
      eventType: 'PLAYER_ACTION',
      actorId: 'jl',
      createdAt: new Date('2026-09-17T00:00:00.000Z'),
      payload: {
        action: { type: 'RAISE', to: 320 },
        source: 'PRIOR',
        streetBefore: 'FLOP',
        streetAfter: 'FLOP',
        board: ['As', '7h', '4c'],
        runoutBoards: [],
        pot: 860,
        phase: 'BETTING',
        holeCards: ['Ah', 'Ad'],
        deck: ['2c'],
        seed: 'private-seed',
        reason: 'internal-profile-reason',
        debug: 'discard-me',
      },
    })

    expect(projected.payload).toEqual({
      action: { type: 'RAISE', to: 320 },
      source: 'PRIOR',
      streetBefore: 'FLOP',
      streetAfter: 'FLOP',
      board: ['As', '7h', '4c'],
      runoutBoards: [],
      pot: 860,
      phase: 'BETTING',
    })
    expect(JSON.stringify(projected)).not.toMatch(
      /holeCards|deck|private-seed|internal-profile-reason|discard-me/,
    )
  })

  it('returns an empty payload for event types without a public contract', () => {
    const projected = toPublicHandEvent({
      id: 'event-2',
      sequenceNo: 3,
      eventType: 'INTERNAL_SNAPSHOT',
      actorId: null,
      createdAt: new Date('2026-09-17T00:00:00.000Z'),
      payload: { state: { deck: ['As'] } },
    })

    expect(projected.payload).toEqual({})
  })
})
