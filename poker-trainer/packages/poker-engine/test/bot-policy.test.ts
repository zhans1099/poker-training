import { describe, expect, it } from 'vitest'
import {
  applyPokerAction,
  chooseProfileBotAction,
  startPokerHand,
} from '../src/index.js'

describe('profile prior bot', () => {
  it('is deterministic for the same state and decision seed', () => {
    const state = startPokerHand({
      seed: 'bot-hand',
      buttonSeat: 1,
      smallBlind: 1,
      bigBlind: 2,
      players: [
        { seat: 1, playerId: 'bot', stack: 100 },
        { seat: 2, playerId: 'hero', stack: 100 },
      ],
    })
    const input = {
      state,
      actorId: 'bot',
      profile: { vpip: 0.9, aggressionFactor: 0.7 },
      seed: 'decision-1',
    }
    expect(chooseProfileBotAction(input)).toEqual(chooseProfileBotAction(input))
  })

  it('always returns an action accepted by the betting engine', () => {
    const state = startPokerHand({
      seed: 'bot-legal',
      buttonSeat: 1,
      smallBlind: 1,
      bigBlind: 2,
      players: [
        { seat: 1, playerId: 'bot', stack: 100 },
        { seat: 2, playerId: 'hero', stack: 100 },
      ],
    })
    const decision = chooseProfileBotAction({
      state,
      actorId: 'bot',
      profile: { vpip: 0.95, aggressionFactor: 0.8 },
      seed: 'decision-2',
    })
    expect(() => applyPokerAction(state, 'bot', decision.action)).not.toThrow()
  })

  it('can drive a six-player hand to settlement without deadlocking', () => {
    let state = startPokerHand({
      seed: 'six-bot-simulation',
      buttonSeat: 1,
      smallBlind: 1,
      bigBlind: 2,
      players: Array.from({ length: 6 }, (_, index) => ({
        seat: index + 1,
        playerId: `bot-${index + 1}`,
        stack: 100,
      })),
    })
    for (let step = 0; step < 200 && state.phase === 'BETTING'; step += 1) {
      const actor = state.betting.players.find(
        (player) => player.seat === state.betting.currentActorSeat,
      )!
      const decision = chooseProfileBotAction({
        state,
        actorId: actor.playerId,
        profile: { vpip: 0.55, aggressionFactor: 0.45, bluffFrequency: 0.2 },
        seed: `six-bot-${step}`,
      })
      state = applyPokerAction(state, actor.playerId, decision.action)
    }

    expect(state.phase).toBe('COMPLETE')
    expect(state.dealt.seats.reduce((sum, seat) => sum + seat.stack, 0)).toBe(
      600,
    )
  })
})
