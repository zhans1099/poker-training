import { describe, expect, it } from 'vitest'
import { randomizeTableSeats } from '../src/index.js'

const players = Array.from({ length: 6 }, (_, index) => ({
  seat: index + 1,
  playerId: `player-${index + 1}`,
  stack: 100 + index,
}))

describe('random seat assignment', () => {
  it('is deterministic for a seed and changes the original order', () => {
    const first = randomizeTableSeats(players, 'seat-seed')
    const second = randomizeTableSeats(players, 'seat-seed')
    expect(first).toEqual(second)
    expect(first.map((player) => player.playerId)).not.toEqual(
      players.map((player) => player.playerId),
    )
  })

  it('preserves every player, stack, and seat exactly once', () => {
    const result = randomizeTableSeats(players, 'another-seat-seed')
    expect(new Set(result.map((player) => player.seat)).size).toBe(6)
    expect(new Set(result.map((player) => player.playerId)).size).toBe(6)
    for (const player of players) {
      expect(
        result.find((candidate) => candidate.playerId === player.playerId)
          ?.stack,
      ).toBe(player.stack)
    }
  })
})
