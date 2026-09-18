import { appendProfileObservation } from '@poker-trainer/database'
import { describe, expect, it } from 'vitest'

describe('profile feedback application', () => {
  it('appends a confirmed observation without changing calibrated traits', () => {
    const profile = { vpip: 0.93, notes: '原始画像', tags: ['loose'] }

    expect(appendProfileObservation(profile, '河牌大注更偏价值。')).toEqual({
      vpip: 0.93,
      notes: '原始画像\n【复盘校准】河牌大注更偏价值。',
      tags: ['loose'],
    })
    expect(profile.notes).toBe('原始画像')
  })

  it('creates notes when a profile has none', () => {
    expect(appendProfileObservation({ vpip: 0.3 }, '样本仍需积累。')).toEqual({
      vpip: 0.3,
      notes: '【复盘校准】样本仍需积累。',
    })
  })
})
