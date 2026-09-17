import type { PlayerAction } from '@poker-trainer/domain'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  applyBettingAction,
  assertBettingRoundInvariant,
  createBettingRound,
  getLegalActions,
  type BettingPlayer,
  type BettingRoundState,
} from '../src/index.js'

function player(
  seat: number,
  stack = 1_000,
  streetContribution = 0,
  totalContribution = streetContribution,
): BettingPlayer {
  return {
    seat,
    playerId: `P${seat}`,
    stack,
    status: stack === 0 ? 'ALL_IN' : 'ACTIVE',
    streetContribution,
    totalContribution,
  }
}

function round(
  players: readonly BettingPlayer[],
  firstToActSeat = 0,
  bigBlind = 20,
): BettingRoundState {
  return createBettingRound({ bigBlind, players, firstToActSeat })
}

function act(
  state: BettingRoundState,
  action: PlayerAction,
): BettingRoundState {
  if (state.currentActorSeat === null) throw new Error('No current actor')
  return applyBettingAction(state, state.currentActorSeat, action)
}

describe('betting legal actions', () => {
  it('calculates preflop call and minimum raise-to from blinds', () => {
    const state = round([
      player(0, 1_000),
      player(1, 990, 10),
      player(2, 980, 20),
    ])
    const legal = getLegalActions(state, 0)

    expect(legal.callAmount).toBe(20)
    expect(legal.callTo).toBe(20)
    expect(legal.minRaiseTo).toBe(40)
    expect(legal.maxTo).toBe(1_000)
    expect(legal.canCheck).toBe(false)
    expect(legal.canRaise).toBe(true)
  })

  it('completes a call-call-check preflop round', () => {
    let state = round([
      player(0, 1_000),
      player(1, 990, 10),
      player(2, 980, 20),
    ])
    state = act(state, { type: 'CALL', to: 20 })
    state = act(state, { type: 'CALL', to: 20 })
    state = act(state, { type: 'CHECK' })

    expect(state.status).toBe('COMPLETE')
    expect(state.currentActorSeat).toBeNull()
    expect(
      state.players.map((candidate) => candidate.streetContribution),
    ).toEqual([20, 20, 20])
    expect(
      state.players.reduce(
        (sum, candidate) => sum + candidate.stack + candidate.totalContribution,
        0,
      ),
    ).toBe(3_000)
  })

  it('uses the previous full raise increment for the next minimum raise', () => {
    let state = round([player(0), player(1, 990, 10), player(2, 980, 20)])
    state = act(state, { type: 'RAISE', to: 120 })
    const legal = getLegalActions(state, 1)
    expect(state.lastFullRaiseSize).toBe(100)
    expect(legal.minRaiseTo).toBe(220)
  })

  it('does not reopen raise rights after one short all-in', () => {
    let state = round([player(0), player(1), player(2, 150)], 0, 100)
    state = act(state, { type: 'BET', to: 100 })
    state = act(state, { type: 'CALL', to: 100 })
    state = act(state, { type: 'ALL_IN', to: 150 })

    const firstCaller = getLegalActions(state, 0)
    expect(firstCaller.callAmount).toBe(50)
    expect(firstCaller.raiseRightsOpen).toBe(false)
    expect(firstCaller.canRaise).toBe(false)
    expect(firstCaller.canAllIn).toBe(false)

    state = act(state, { type: 'CALL', to: 150 })
    state = act(state, { type: 'CALL', to: 150 })
    expect(state.status).toBe('COMPLETE')
  })

  it('reopens raise rights when cumulative short all-ins reach a full raise', () => {
    let state = round(
      [player(0), player(1), player(2, 150), player(3, 200)],
      0,
      100,
    )
    state = act(state, { type: 'BET', to: 100 })
    state = act(state, { type: 'CALL', to: 100 })
    state = act(state, { type: 'ALL_IN', to: 150 })
    state = act(state, { type: 'ALL_IN', to: 200 })

    const legal = getLegalActions(state, 0)
    expect(legal.raiseRightsOpen).toBe(true)
    expect(legal.minRaiseTo).toBe(300)
    expect(legal.canRaise).toBe(true)
  })

  it('allows a checker to raise a later incomplete opening all-in', () => {
    let state = round([player(0), player(1, 50), player(2)], 0, 100)
    state = act(state, { type: 'CHECK' })
    state = act(state, { type: 'ALL_IN', to: 50 })
    state = act(state, { type: 'CALL', to: 50 })

    const legal = getLegalActions(state, 0)
    expect(legal.raiseRightsOpen).toBe(true)
    expect(legal.minRaiseTo).toBe(150)
    expect(legal.canRaise).toBe(true)
  })

  it('rejects an illegal amount without mutating the previous state', () => {
    const state = round([player(0), player(1), player(2)])
    const before = JSON.stringify(state)
    expect(() =>
      applyBettingAction(state, 0, { type: 'RAISE', to: 30 }),
    ).toThrow('Raise is outside the legal raise-to range')
    expect(JSON.stringify(state)).toBe(before)
  })

  it('preserves chips for arbitrary legal first actions', () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 1_000 }), (betTo) => {
        const state = round([player(0), player(1), player(2)])
        const next = applyBettingAction(state, 0, {
          type: 'BET',
          to: betTo,
        })
        assertBettingRoundInvariant(next)
        expect(
          next.players.reduce(
            (sum, candidate) =>
              sum + candidate.stack + candidate.totalContribution,
            0,
          ),
        ).toBe(state.chipsInPlay)
      }),
      { numRuns: 500 },
    )
  })
})
