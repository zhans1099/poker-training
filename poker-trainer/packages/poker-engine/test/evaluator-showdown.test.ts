import { describe, expect, it } from 'vitest'
import {
  compareEvaluatedHands,
  determineMultiRunoutSettlement,
  determineShowdownSettlement,
  evaluateBestHand,
} from '../src/index.js'

describe('holdem evaluator', () => {
  it('selects the best five-card hand from seven cards', () => {
    const straightFlush = evaluateBestHand([
      '9h',
      'Th',
      'Jh',
      'Qh',
      'Kh',
      '2c',
      '2d',
    ])
    const quads = evaluateBestHand(['Ac', 'Ad', 'Ah', 'As', 'Kh', '2c', '3d'])

    expect(straightFlush.category).toBe('STRAIGHT_FLUSH')
    expect(quads.category).toBe('FOUR_OF_A_KIND')
    expect(compareEvaluatedHands(straightFlush, quads)).toBeGreaterThan(0)
  })

  it('recognizes an ace-low straight', () => {
    const hand = evaluateBestHand(['Ac', '2d', '3h', '4s', '5c', 'Kd', 'Qh'])
    expect(hand.category).toBe('STRAIGHT')
    expect(hand.tiebreak).toEqual([5])
  })
})

describe('showdown and side pots', () => {
  it('splits each contested pot across two independent runouts', () => {
    const settlement = determineMultiRunoutSettlement({
      boards: [
        ['2c', '3d', '4h', '9s', 'Th'],
        ['2d', '7c', '8h', '9c', 'Ks'],
      ],
      buttonSeat: 2,
      players: [
        {
          seat: 1,
          playerId: 'a',
          status: 'ALL_IN',
          totalContribution: 5,
          holeCards: ['As', '5s'],
        },
        {
          seat: 2,
          playerId: 'b',
          status: 'ALL_IN',
          totalContribution: 5,
          holeCards: ['Kc', 'Kd'],
        },
      ],
    })

    expect(settlement.runouts).toHaveLength(2)
    expect(settlement.runouts[0]?.pots[0]?.amount).toBe(5)
    expect(settlement.runouts[0]?.pots[0]?.winnerPlayerIds).toEqual(['a'])
    expect(settlement.runouts[1]?.pots[0]?.amount).toBe(5)
    expect(settlement.runouts[1]?.pots[0]?.winnerPlayerIds).toEqual(['b'])
    expect(settlement.payouts).toEqual({ a: 5, b: 5 })
  })

  it('awards main and side pots independently', () => {
    const settlement = determineShowdownSettlement({
      board: ['2c', '3d', '4h', '8s', '9c'],
      buttonSeat: 3,
      players: [
        {
          seat: 1,
          playerId: 'a',
          status: 'ALL_IN',
          totalContribution: 100,
          holeCards: ['Ac', 'Ad'],
        },
        {
          seat: 2,
          playerId: 'b',
          status: 'ALL_IN',
          totalContribution: 200,
          holeCards: ['Kc', 'Kd'],
        },
        {
          seat: 3,
          playerId: 'c',
          status: 'ALL_IN',
          totalContribution: 200,
          holeCards: ['Qc', 'Qd'],
        },
      ],
    })

    expect(settlement.pots.map((pot) => pot.amount)).toEqual([300, 200])
    expect(settlement.payouts).toEqual({ a: 300, b: 200, c: 0 })
  })

  it('gives an odd chip to the first tied winner left of the button', () => {
    const settlement = determineShowdownSettlement({
      board: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'],
      buttonSeat: 3,
      players: [
        {
          seat: 1,
          playerId: 'a',
          status: 'ACTIVE',
          totalContribution: 1,
          holeCards: ['2c', '3c'],
        },
        {
          seat: 2,
          playerId: 'b',
          status: 'ACTIVE',
          totalContribution: 1,
          holeCards: ['4c', '5c'],
        },
        {
          seat: 3,
          playerId: 'folded',
          status: 'FOLDED',
          totalContribution: 1,
          holeCards: ['6c', '7c'],
        },
      ],
    })

    expect(settlement.payouts).toEqual({ a: 2, b: 1, folded: 0 })
  })
})
