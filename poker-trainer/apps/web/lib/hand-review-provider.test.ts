import { describe, expect, it } from 'vitest'
import {
  reviewCompletedHand,
  type HandReviewProviderError,
  type HandReviewInput,
} from './hand-review-provider'

const input: HandReviewInput = {
  handId: 'hand-1',
  heroId: 'hero',
  heroSeatNo: 2,
  heroPosition: 'BIG_BLIND',
  status: 'COMPLETED',
  players: [
    { playerId: 'hero', displayName: 'Hero', kind: 'HERO' },
    { playerId: 'jl', displayName: 'JL', kind: 'OPPONENT' },
  ],
  publicEvents: [{ type: 'PLAYER_ACTED', actorId: 'hero' }],
  heroDecisions: [
    {
      eventSequence: 2,
      actorView: { holeCards: ['As', 'Kh'] },
      legalActions: { canFold: true, canCall: true },
      chosenAction: { type: 'CALL', to: 20 },
    },
  ],
}

const environment = {
  DEEPSEEK_API_KEY: 'test-key',
  DEEPSEEK_BASE_URL: 'https://api.deepseek.test/v1',
  AI_REVIEW_MODEL: 'deepseek-test',
}

function validReview() {
  return {
    summary: 'Hero 整体决策合理。',
    decisionReviews: [
      {
        eventSequence: 2,
        street: 'PREFLOP',
        verdict: 'GOOD',
        explanation: '赔率允许跟注。',
        recommendedAction: 'CALL 20',
      },
    ],
    leaks: [],
    profileObservations: [
      { playerId: 'jl', observation: '本手样本不足。', confidence: 0.2 },
    ],
  }
}

describe('hand review provider', () => {
  it('requests JSON review and returns audit metadata', async () => {
    let body = ''
    const result = await reviewCompletedHand(input, {
      environment,
      fetchImpl: (request, init) => {
        const requestedUrl =
          request instanceof Request ? request.url : request.toString()
        expect(requestedUrl).toBe(
          'https://api.deepseek.test/v1/chat/completions',
        )
        body = typeof init?.body === 'string' ? init.body : ''
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [
                { message: { content: JSON.stringify(validReview()) } },
              ],
              usage: { prompt_tokens: 200, completion_tokens: 80 },
            }),
          ),
        )
      },
    })

    expect(result).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-test',
      inputTokens: 200,
      outputTokens: 80,
    })
    expect(body).not.toContain('test-key')
    expect(body).toContain('只输出 JSON')
    expect(body).toContain('必须使用简体中文')
    expect(JSON.parse(body)).toMatchObject({
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
    })
  })

  it('rejects profile observations for players outside the hand', async () => {
    const review = validReview()
    review.profileObservations[0]!.playerId = 'unknown'
    await expect(
      reviewCompletedHand(input, {
        environment,
        fetchImpl: () =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                choices: [{ message: { content: JSON.stringify(review) } }],
              }),
            ),
          ),
      }),
    ).rejects.toMatchObject<Partial<HandReviewProviderError>>({
      code: 'UNKNOWN_PROFILE_SUBJECT',
    })
  })

  it('does not expose an upstream error body', async () => {
    await expect(
      reviewCompletedHand(input, {
        environment,
        fetchImpl: () =>
          Promise.resolve(new Response('secret detail', { status: 500 })),
      }),
    ).rejects.toMatchObject<Partial<HandReviewProviderError>>({
      code: 'HTTP_500',
    })
  })
})
