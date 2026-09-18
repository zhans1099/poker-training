import { z } from 'zod'

const PROMPT_VERSION = 'hand-review-v1'
const DEFAULT_TIMEOUT_MS = 90_000

export const handReviewSchema = z
  .object({
    summary: z.string().trim().min(1).max(2_000),
    decisionReviews: z.array(
      z
        .object({
          eventSequence: z.number().int().positive(),
          street: z.string().trim().min(1).max(20),
          verdict: z.enum(['GOOD', 'MIXED', 'ERROR']),
          explanation: z.string().trim().min(1).max(1_000),
          recommendedAction: z.string().trim().min(1).max(300),
        })
        .strict(),
    ),
    leaks: z.array(
      z
        .object({
          code: z.string().trim().min(1).max(80),
          street: z.string().trim().min(1).max(20),
          severity: z.number().int().min(1).max(5),
          evidence: z.string().trim().min(1).max(1_000),
          recommendation: z.string().trim().min(1).max(1_000),
        })
        .strict(),
    ),
    profileObservations: z.array(
      z
        .object({
          playerId: z.string().trim().min(1).max(30),
          observation: z.string().trim().min(1).max(1_000),
          confidence: z.number().min(0).max(1),
        })
        .strict(),
    ),
  })
  .strict()

const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z
          .object({ content: z.string().nullable().optional() })
          .passthrough(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().nullish(),
      completion_tokens: z.number().int().nonnegative().nullish(),
    })
    .nullish(),
})

export interface HandReviewInput {
  handId: string
  heroId: string
  heroSeatNo: number
  heroPosition: 'BUTTON' | 'SMALL_BLIND' | 'BIG_BLIND' | 'OTHER'
  status: 'COMPLETED'
  players: readonly {
    playerId: string
    displayName: string
    kind: 'HERO' | 'OPPONENT'
  }[]
  publicEvents: readonly Record<string, unknown>[]
  heroDecisions: readonly {
    eventSequence: number
    actorView: Record<string, unknown>
    thoughtInput?: Record<string, unknown> | undefined
    legalActions: Record<string, unknown>
    chosenAction: Record<string, unknown>
  }[]
  result?: Record<string, unknown> | undefined
}

export interface AuditedHandReview {
  provider: 'deepseek'
  model: string
  promptVersion: string
  review: z.infer<typeof handReviewSchema>
  latencyMs: number
  inputTokens?: number | undefined
  outputTokens?: number | undefined
}

interface Dependencies {
  environment?: Readonly<Record<string, string | undefined>> | undefined
  fetchImpl?: typeof fetch | undefined
}

export class HandReviewProviderError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'HandReviewProviderError'
  }
}

function completionUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '')
  return normalized.endsWith('/chat/completions')
    ? normalized
    : `${normalized}/chat/completions`
}

export async function reviewCompletedHand(
  input: HandReviewInput,
  dependencies: Dependencies = {},
): Promise<AuditedHandReview> {
  const environment = dependencies.environment ?? process.env
  const apiKey = environment.DEEPSEEK_API_KEY
  const baseUrl = environment.DEEPSEEK_BASE_URL
  const model = environment.AI_REVIEW_MODEL
  if (!apiKey || !baseUrl || !model) {
    throw new HandReviewProviderError('PROVIDER_NOT_CONFIGURED')
  }
  const configuredTimeout = Number(environment.AI_REVIEW_TIMEOUT_MS)
  const timeoutMs =
    Number.isSafeInteger(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_TIMEOUT_MS
  const startedAt = performance.now()
  let response: Response
  try {
    response = await (dependencies.fetchImpl ?? fetch)(completionUrl(baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              '你是德州扑克教练。基于 Hero 当时可见的信息、公开行动和 Hero 的思考记录复盘整手牌。不要假设未公开的对手私牌。只输出 JSON，不输出隐藏推理。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: '复盘 Hero 的每个决策，识别可复现的 leak，并记录低风险的对手画像观察。',
              positionRule:
                '必须使用 hand.heroPosition 描述 Hero 位置；OTHER 时只写座位号。描述对手行动时必须写成“JL 加注、JJ 3bet”这种姓名加行动的格式，只能使用 players 中的 displayName；禁止用前位、中位、后位、枪口位、UTG、HJ、CO、BTN、SB、BB 等未经明确提供的位置称呼。',
              languageRule:
                'summary、explanation、recommendedAction、evidence、recommendation 和 observation 必须使用简体中文；牌型、动作缩写与 leak code 可以保留英文。',
              outputShape: {
                summary: 'string',
                decisionReviews: [
                  {
                    eventSequence: 1,
                    street: 'PREFLOP',
                    verdict: 'GOOD | MIXED | ERROR',
                    explanation: 'string',
                    recommendedAction: 'string',
                  },
                ],
                leaks: [
                  {
                    code: 'string',
                    street: 'string',
                    severity: 'integer 1-5',
                    evidence: 'string',
                    recommendation: 'string',
                  },
                ],
                profileObservations: [
                  {
                    playerId: 'string',
                    observation: 'string',
                    confidence: 'number 0-1',
                  },
                ],
              },
              hand: input,
            }),
          },
        ],
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        max_tokens: 4_000,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new HandReviewProviderError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'TIMEOUT'
        : 'NETWORK_ERROR',
    )
  }
  if (!response.ok) {
    throw new HandReviewProviderError(`HTTP_${response.status}`)
  }
  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch (error) {
    throw new HandReviewProviderError(
      error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError')
        ? 'RESPONSE_BODY_TIMEOUT'
        : 'INVALID_PROVIDER_JSON',
    )
  }
  const completion = completionSchema.safeParse(responseBody)
  if (!completion.success) {
    const path = completion.error.issues[0]?.path.join('_').toUpperCase()
    throw new HandReviewProviderError(
      path ? `INVALID_PROVIDER_RESPONSE_${path}` : 'INVALID_PROVIDER_RESPONSE',
    )
  }
  const content = completion.data.choices[0]?.message.content
  if (typeof content !== 'string' || content.trim() === '') {
    throw new HandReviewProviderError('EMPTY_MODEL_OUTPUT')
  }
  let decoded: unknown
  try {
    decoded = JSON.parse(content)
  } catch {
    throw new HandReviewProviderError('INVALID_MODEL_JSON')
  }
  const review = handReviewSchema.safeParse(decoded)
  if (!review.success) {
    throw new HandReviewProviderError('INVALID_MODEL_OUTPUT')
  }
  const participantIds = new Set(input.players.map((player) => player.playerId))
  if (
    review.data.profileObservations.some(
      (observation) => !participantIds.has(observation.playerId),
    )
  ) {
    throw new HandReviewProviderError('UNKNOWN_PROFILE_SUBJECT')
  }

  return {
    provider: 'deepseek',
    model,
    promptVersion: PROMPT_VERSION,
    review: review.data,
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    inputTokens: completion.data.usage?.prompt_tokens ?? undefined,
    outputTokens: completion.data.usage?.completion_tokens ?? undefined,
  }
}
