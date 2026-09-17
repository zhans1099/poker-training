import { describe, expect, it } from 'vitest'
import {
  applyPokerAction,
  createActorView,
  startPokerHand,
} from '../src/index.js'

describe('complete poker hand state', () => {
  it('hides the deck and other players hole cards from actor views', () => {
    const state = startPokerHand({
      seed: 'actor-view-security',
      buttonSeat: 1,
      smallBlind: 1,
      bigBlind: 2,
      players: [
        { seat: 1, playerId: 'hero', stack: 100 },
        { seat: 2, playerId: 'jl', stack: 100 },
        { seat: 3, playerId: 'jj', stack: 100 },
      ],
    })
    const view = createActorView(state, 'hero')
    expect(
      view.seats.find((seat) => seat.playerId === 'hero')?.holeCards,
    ).toHaveLength(2)
    expect(
      view.seats.find((seat) => seat.playerId === 'jl')?.holeCards,
    ).toBeNull()
    expect(JSON.stringify(view)).not.toContain('deck')
    expect(JSON.stringify(view)).not.toContain('burnCards')
    expect(JSON.stringify(view)).not.toContain('actor-view-security')
  })

  it('awards the pot when every opponent folds', () => {
    let state = startPokerHand({
      seed: 'fold-settlement',
      buttonSeat: 1,
      smallBlind: 1,
      bigBlind: 2,
      players: [
        { seat: 1, playerId: 'hero', stack: 100 },
        { seat: 2, playerId: 'jl', stack: 100 },
        { seat: 3, playerId: 'jj', stack: 100 },
      ],
    })
    state = applyPokerAction(state, 'hero', { type: 'FOLD' })
    state = applyPokerAction(state, 'jl', { type: 'FOLD' })

    expect(state.phase).toBe('COMPLETE')
    expect(state.pot).toBe(0)
    expect(state.result).toEqual({
      reason: 'ALL_OTHERS_FOLDED',
      winnerPlayerId: 'jj',
      potAwarded: 3,
    })
    expect(
      state.dealt.seats.reduce((total, seat) => total + seat.stack, 0),
    ).toBe(300)
  })

  it('moves to the flop after preflop action closes', () => {
    let state = startPokerHand({
      seed: 'street-transition',
      buttonSeat: 1,
      smallBlind: 1,
      bigBlind: 2,
      players: [
        { seat: 1, playerId: 'hero', stack: 100 },
        { seat: 2, playerId: 'jl', stack: 100 },
      ],
    })
    state = applyPokerAction(state, 'hero', { type: 'CALL', to: 2 })
    state = applyPokerAction(state, 'jl', { type: 'CHECK' })

    expect(state.phase).toBe('BETTING')
    expect(state.dealt.street).toBe('FLOP')
    expect(state.dealt.board).toHaveLength(3)
    expect(state.betting.currentActorSeat).toBe(2)
    expect(state.betting.currentBet).toBe(0)
    expect(state.pot).toBe(4)
  })

  it('runs out the board and settles when every player is all-in', () => {
    let state = startPokerHand({
      seed: 'all-in-showdown',
      buttonSeat: 1,
      smallBlind: 1,
      bigBlind: 2,
      players: [
        { seat: 1, playerId: 'hero', stack: 10 },
        { seat: 2, playerId: 'jl', stack: 10 },
      ],
    })
    state = applyPokerAction(state, 'hero', { type: 'ALL_IN', to: 10 })
    state = applyPokerAction(state, 'jl', { type: 'CALL', to: 10 })

    expect(state.phase).toBe('COMPLETE')
    expect(state.dealt.street).toBe('SHOWDOWN')
    expect(state.dealt.board).toHaveLength(5)
    expect(state.runoutBoards).toHaveLength(2)
    expect(new Set(state.runoutBoards.flat())).toHaveProperty('size', 10)
    expect(state.result?.reason).toBe('SHOWDOWN')
    expect(
      state.dealt.seats.reduce((total, seat) => total + seat.stack, 0),
    ).toBe(20)
  })

  it('shares the existing flop and deals turn and river twice', () => {
    let state = startPokerHand({
      seed: 'flop-all-in-twice',
      buttonSeat: 1,
      smallBlind: 1,
      bigBlind: 2,
      players: [
        { seat: 1, playerId: 'hero', stack: 20 },
        { seat: 2, playerId: 'jl', stack: 20 },
      ],
    })
    state = applyPokerAction(state, 'hero', { type: 'CALL', to: 2 })
    state = applyPokerAction(state, 'jl', { type: 'CHECK' })
    const sharedFlop = state.dealt.board
    state = applyPokerAction(state, 'jl', { type: 'ALL_IN', to: 18 })
    state = applyPokerAction(state, 'hero', { type: 'CALL', to: 18 })

    expect(state.runoutBoards).toHaveLength(2)
    expect(state.runoutBoards[0]?.slice(0, 3)).toEqual(sharedFlop)
    expect(state.runoutBoards[1]?.slice(0, 3)).toEqual(sharedFlop)
    expect(state.runoutBoards[0]?.slice(3)).not.toEqual(
      state.runoutBoards[1]?.slice(3),
    )
    expect(
      state.dealt.seats.reduce((total, seat) => total + seat.stack, 0),
    ).toBe(40)
  })
})
