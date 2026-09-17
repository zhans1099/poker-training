import { describe, expect, it } from 'vitest'
import { classifyDecisionSpot, type PublicActionEvent } from '../src/index.js'

function event(
  sequence: number,
  street: PublicActionEvent['street'],
  playerId: string,
  action: PublicActionEvent['action'],
  raisesCurrentBet?: boolean,
): PublicActionEvent {
  return raisesCurrentBet === undefined
    ? { sequence, street, playerId, action }
    : { sequence, street, playerId, action, raisesCurrentBet }
}

describe('decision spot classifier', () => {
  it('labels open, squeeze three-bet and four-bet from action history', () => {
    const history: PublicActionEvent[] = [
      event(1, 'PREFLOP', 'Z', 'RAISE'),
      event(2, 'PREFLOP', 'J', 'CALL'),
      event(3, 'PREFLOP', 'L', 'RAISE'),
      event(4, 'PREFLOP', 'Z', 'RAISE'),
    ]

    expect(classifyDecisionSpot(history, 0)).toEqual(['OPEN_RAISE'])
    expect(classifyDecisionSpot(history, 2)).toEqual(['THREE_BET', 'SQUEEZE'])
    expect(classifyDecisionSpot(history, 3)).toEqual(['FOUR_BET'])
  })

  it('distinguishes limp-reraise and back-raise', () => {
    const limpReraise: PublicActionEvent[] = [
      event(1, 'PREFLOP', 'Z', 'CALL'),
      event(2, 'PREFLOP', 'L', 'RAISE'),
      event(3, 'PREFLOP', 'Z', 'RAISE'),
    ]
    const backRaise: PublicActionEvent[] = [
      event(1, 'PREFLOP', 'L', 'RAISE'),
      event(2, 'PREFLOP', 'Z', 'CALL'),
      event(3, 'PREFLOP', 'J', 'RAISE'),
      event(4, 'PREFLOP', 'Z', 'RAISE'),
    ]

    expect(classifyDecisionSpot(limpReraise, 2)).toContain('LIMP_RERAISE')
    expect(classifyDecisionSpot(backRaise, 3)).toContain('BACK_RAISE')
  })

  it('requires check then an opponent bet for a check-raise', () => {
    const history: PublicActionEvent[] = [
      event(1, 'FLOP', 'Hero', 'CHECK'),
      event(2, 'FLOP', 'Z', 'BET'),
      event(3, 'FLOP', 'Hero', 'RAISE'),
    ]

    expect(classifyDecisionSpot(history, 2)).toEqual([
      'CHECK_RAISE',
      'RERAISE_POSTFLOP',
    ])
    expect(classifyDecisionSpot(history, 1)).not.toContain('CHECK_RAISE')
  })

  it('labels c-bet and multi-street barrels deterministically', () => {
    const history: PublicActionEvent[] = [
      event(1, 'PREFLOP', 'Hero', 'RAISE'),
      event(2, 'PREFLOP', 'Z', 'CALL'),
      event(3, 'FLOP', 'Z', 'CHECK'),
      event(4, 'FLOP', 'Hero', 'BET'),
      event(5, 'FLOP', 'Z', 'CALL'),
      event(6, 'TURN', 'Z', 'CHECK'),
      event(7, 'TURN', 'Hero', 'BET'),
      event(8, 'TURN', 'Z', 'CALL'),
      event(9, 'RIVER', 'Z', 'CHECK'),
      event(10, 'RIVER', 'Hero', 'BET'),
    ]

    expect(classifyDecisionSpot(history, 3)).toContain('CBET')
    expect(classifyDecisionSpot(history, 6)).toContain('DOUBLE_BARREL')
    expect(classifyDecisionSpot(history, 9)).toContain('TRIPLE_BARREL')
  })

  it('treats a calling all-in as non-aggressive', () => {
    const history: PublicActionEvent[] = [
      event(1, 'PREFLOP', 'Z', 'RAISE'),
      event(2, 'PREFLOP', 'J', 'ALL_IN', false),
    ]
    expect(classifyDecisionSpot(history, 1)).toEqual([])
  })
})
