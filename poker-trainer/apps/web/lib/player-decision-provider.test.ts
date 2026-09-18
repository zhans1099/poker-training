import { createActorView, startPokerHand } from '@poker-trainer/poker-engine'
import { describe, expect, it } from 'vitest'
import {
  chooseAuditedPlayerAction,
  type PlayerDecisionInput,
} from './player-decision-provider'

function decisionInput(): PlayerDecisionInput {
  const state = startPokerHand({
    seed: 'provider-test-seed',
    buttonSeat: 1,
    smallBlind: 10,
    bigBlind: 20,
    players: [
      { seat: 1, playerId: 'actor', stack: 2_000 },
      { seat: 2, playerId: 'hero', stack: 2_000 },
    ],
  })
  return {
    state,
    actorId: 'actor',
    heroId: 'hero',
    profile: { vpip: 0.9, notes: '测试画像' },
    seed: 'provider-decision-seed',
    actorView: createActorView(state, 'actor'),
    players: [
      { playerId: 'actor', displayName: 'JL', kind: 'OPPONENT' },
      { playerId: 'hero', displayName: 'Hero', kind: 'HERO' },
    ],
    publicEvents: [],
  }
}

const qwenEnvironment = {
  LLM_PRIMARY_PROVIDER: 'qwen',
  QWEN_API_KEY: 'test-key',
  QWEN_BASE_URL: 'https://example.test/compatible-mode/v1',
  AI_PLAYER_MODEL: 'qwen-test',
}

function completion(content: Record<string, unknown>, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
      usage: { prompt_tokens: 123, completion_tokens: 17 },
    }),
    { status, headers: { 'content-type': 'application/json' } },
  )
}

describe('player decision provider', () => {
  it('uses the deterministic prior when the LLM is disabled', async () => {
    const result = await chooseAuditedPlayerAction(decisionInput(), {
      environment: { AI_PROVIDER: 'prior' },
    })

    expect(result.source).toBe('PRIOR')
    expect(result.provider).toBe('prior')
  })

  it('accepts a schema-valid legal Qwen decision without leaking hole cards', async () => {
    const input = decisionInput()
    const opponentCards = input.state.dealt.seats.find(
      (seat) => seat.playerId === 'hero',
    )!.holeCards
    let requestBody = ''
    const fetchImpl: typeof fetch = (request, init) => {
      const requestedUrl =
        request instanceof Request ? request.url : request.toString()
      expect(requestedUrl).toBe(
        'https://example.test/compatible-mode/v1/chat/completions',
      )
      requestBody = typeof init?.body === 'string' ? init.body : ''
      return Promise.resolve(
        completion({
          type: 'CALL',
          to: input.actorView.legalActions!.callTo,
          reason: '画像偏松，按当前价格继续。',
        }),
      )
    }
    const result = await chooseAuditedPlayerAction(input, {
      environment: qwenEnvironment,
      fetchImpl,
    })

    expect(result).toMatchObject({
      source: 'LLM',
      provider: 'qwen',
      model: 'qwen-test',
      action: { type: 'CALL', to: 20 },
      inputTokens: 123,
      outputTokens: 17,
    })
    for (const card of opponentCards) expect(requestBody).not.toContain(card)
    expect(requestBody).not.toContain(input.state.dealt.seed)
  })

  it('accepts a base URL that already contains the completion path', async () => {
    let requestedUrl = ''
    const fetchImpl: typeof fetch = (request) => {
      requestedUrl =
        request instanceof Request ? request.url : request.toString()
      return Promise.resolve(
        completion({ type: 'CALL', to: 20, reason: '继续跟注。' }),
      )
    }
    await chooseAuditedPlayerAction(decisionInput(), {
      environment: {
        ...qwenEnvironment,
        QWEN_BASE_URL:
          'https://example.test/compatible-mode/v1/chat/completions/',
      },
      fetchImpl,
    })

    expect(requestedUrl).toBe(
      'https://example.test/compatible-mode/v1/chat/completions',
    )
  })

  it('falls back to the prior when the model returns an illegal action', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        completion({
          type: 'RAISE',
          to: 9_999,
          reason: '故意返回非法金额',
        }),
      )
    const result = await chooseAuditedPlayerAction(decisionInput(), {
      environment: qwenEnvironment,
      fetchImpl,
    })

    expect(result.source).toBe('FALLBACK')
    expect(result.model).toBe('qwen-test')
    expect(result.latencyMs).toBeTypeOf('number')
    expect(result.validation).toMatchObject({
      fallbackReason: 'ILLEGAL_ACTION',
      acceptedByRuleEngine: true,
    })
  })

  it('skips the remote provider when the per-turn LLM budget is exhausted', async () => {
    let requested = false
    const fetchImpl: typeof fetch = () => {
      requested = true
      return Promise.resolve(completion({}))
    }
    const result = await chooseAuditedPlayerAction(decisionInput(), {
      environment: qwenEnvironment,
      allowLlm: false,
      fetchImpl,
    })

    expect(result.source).toBe('PRIOR')
    expect(requested).toBe(false)
  })

  it('falls back without exposing an HTTP response body', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response('sensitive upstream details', { status: 503 }),
      )
    const result = await chooseAuditedPlayerAction(decisionInput(), {
      environment: qwenEnvironment,
      fetchImpl,
    })

    expect(result.validation).toMatchObject({ fallbackReason: 'HTTP_503' })
    expect(JSON.stringify(result)).not.toContain('sensitive upstream details')
  })
})
