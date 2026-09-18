import { describe, expect, it } from 'vitest'
import { nextButtonPlayerId } from './next-hand'

describe('next hand button rotation', () => {
  it('moves the button clockwise to the next funded player', () => {
    expect(
      nextButtonPlayerId(2, [
        { seat: 1, playerId: 'a', stack: 100 },
        { seat: 2, playerId: 'b', stack: 100 },
        { seat: 3, playerId: 'c', stack: 100 },
      ]),
    ).toBe('c')
  })

  it('skips busted players and wraps around the table', () => {
    expect(
      nextButtonPlayerId(5, [
        { seat: 1, playerId: 'a', stack: 100 },
        { seat: 3, playerId: 'b', stack: 0 },
        { seat: 5, playerId: 'c', stack: 100 },
        { seat: 6, playerId: 'd', stack: 0 },
      ]),
    ).toBe('a')
  })

  it('rejects a table with fewer than two funded players', () => {
    expect(() =>
      nextButtonPlayerId(1, [
        { seat: 1, playerId: 'a', stack: 100 },
        { seat: 2, playerId: 'b', stack: 0 },
      ]),
    ).toThrow('至少需要两名仍有筹码的玩家')
  })
})
