import { submitHandActionSchema } from '@poker-trainer/schemas'
import { describe, expect, it } from 'vitest'

const baseAction = {
  expectedVersion: 4,
  commandId: 'hero_action_0001',
  action: { type: 'CALL' as const, to: 320 },
}

describe('hero thought input contract', () => {
  it('accepts a minimal quick-mode note', () => {
    expect(
      submitHandActionSchema.safeParse({
        ...baseAction,
        thoughtInput: { mode: 'QUICK', note: '对手范围偏宽' },
      }).success,
    ).toBe(true)
  })

  it('requires all comparison fields in training mode', () => {
    const result = submitHandActionSchema.safeParse({
      ...baseAction,
      thoughtInput: {
        mode: 'TRAINING',
        rangeStrength: 'MEDIUM',
        purpose: 'VALUE',
        equityEstimate: 0.48,
      },
    })

    expect(result.success).toBe(false)
  })

  it('accepts complete training data and rejects invalid probabilities', () => {
    const thoughtInput = {
      mode: 'TRAINING' as const,
      rangeStrength: 'MEDIUM' as const,
      purpose: 'VALUE' as const,
      potOddsEstimate: 0.205,
      equityEstimate: 0.48,
    }
    expect(
      submitHandActionSchema.safeParse({ ...baseAction, thoughtInput }).success,
    ).toBe(true)
    expect(
      submitHandActionSchema.safeParse({
        ...baseAction,
        thoughtInput: { ...thoughtInput, equityEstimate: 1.2 },
      }).success,
    ).toBe(false)
  })

  it('requires the additional deep-mode analysis fields', () => {
    const result = submitHandActionSchema.safeParse({
      ...baseAction,
      thoughtInput: {
        mode: 'DEEP',
        rangeStrength: 'STRONG',
        purpose: 'PROTECTION',
        potOddsEstimate: 0.205,
        equityEstimate: 0.62,
        rangeCategory: '顶对以上与强听牌',
        madeHandCategory: '顶对强踢脚',
        comboEstimate: 24,
        blockers: ['Kh', 'Qh'],
        outs: 9,
        futurePlan: '安全转牌继续价值下注',
        versusRaisePlan: '小加注跟注，大尺度加注重新评估',
      },
    })

    expect(result.success).toBe(true)
  })
})
