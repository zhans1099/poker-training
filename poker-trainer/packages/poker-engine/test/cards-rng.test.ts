import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  SeededRng,
  createStandardDeck,
  parseCard,
  shuffleWithSeed,
} from '../src/index.js'

describe('cards', () => {
  it('creates exactly 52 unique standard cards', () => {
    const deck = createStandardDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck)).toHaveLength(52)
    expect(deck).toContain('2c')
    expect(deck).toContain('As')
  })

  it('rejects malformed card strings', () => {
    expect(() => parseCard('1s')).toThrow('Invalid card')
    expect(() => parseCard('AS')).toThrow('Invalid card')
    expect(() => parseCard('10h')).toThrow('Invalid card')
  })
})

describe('seeded random', () => {
  it('replays the same sequence for the same seed', () => {
    const first = new SeededRng('hand-839217')
    const second = new SeededRng('hand-839217')
    expect(Array.from({ length: 20 }, () => first.nextUint32())).toEqual(
      Array.from({ length: 20 }, () => second.nextUint32()),
    )
  })

  it('produces deterministic, permutation-safe shuffles for arbitrary seeds', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const deck = createStandardDeck()
        const first = shuffleWithSeed(deck, seed)
        const second = shuffleWithSeed(deck, seed)
        expect(first).toEqual(second)
        expect(first).toHaveLength(52)
        expect(new Set(first)).toHaveLength(52)
        expect([...first].toSorted()).toEqual([...deck].toSorted())
      }),
      { numRuns: 1_000 },
    )
  })
})
