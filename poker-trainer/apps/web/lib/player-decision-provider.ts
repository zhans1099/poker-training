import type { PlayerAction } from '@poker-trainer/domain'
import {
  chooseProfileBotAction,
  type PokerActorView,
  type PokerHandState,
  type ProfileBotDecision,
} from '@poker-trainer/poker-engine'
import { z } from 'zod'

const PROMPT_VERSION = 'player-decision-v1'
const DEFAULT_TIMEOUT_MS = 5_000

const modelDecisionSchema = z
  .object({
    type: z.enum(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']),
    to: z.number().int().nonnegative().nullable(),
    reason: z.string().trim().min(1).max(300),
  })
  .strict()

const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }).passthrough(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
})

type DecisionSource = 'PRIOR' | 'LLM' | 'FALLBACK'

export interface AuditedPlayerDecision extends ProfileBotDecision {
  provider: string
  model: string
  source: DecisionSource
  promptVersion: string
  validation: Record<string, unknown>
  latencyMs?: number | undefined
  inputTokens?: number | undefined
  outputTokens?: number | undefined
}

export interface PlayerDecisionInput {
  state: PokerHandState
  actorId: string
  heroId: string
  profile: Readonly<Record<string, unknown>>
  seed: string
  actorView: PokerActorView
  players: readonly {
    playerId: string
    displayName: string
    kind: 'HERO' | 'OPPONENT'
  }[]
  publicEvents: readonly Record<string, unknown>[]
}

interface ProviderConfig {
  provider: 'qwen'
  model: string
  apiKey: string
  baseUrl: string
  timeoutMs: number
}

interface ProviderDependencies {
  environment?: Readonly<Record<string, string | undefined>> | undefined
  fetchImpl?: typeof fetch | undefined
  allowLlm?: boolean | undefined
}

class PlayerDecisionProviderError extends Error {
  constructor(
    readonly code: string,
    readonly latencyMs?: number,
  ) {
    super(code)
    this.name = 'PlayerDecisionProviderError'
  }
}

function configuredProvider(
  environment: Readonly<Record<string, string | undefined>>,
): ProviderConfig | null {
  const provider = (
    environment.LLM_PRIMARY_PROVIDER ??
    environment.AI_PROVIDER ??
    'prior'
  ).toLowerCase()
  if (provider === 'prior' || provider === 'none' || provider === 'disabled') {
    return null
  }
  if (provider !== 'qwen') {
    throw new PlayerDecisionProviderError('UNSUPPORTED_PROVIDER')
  }
  const apiKey = environment.QWEN_API_KEY ?? environment.DASHSCOPE_API_KEY
  const baseUrl = environment.QWEN_BASE_URL
  const model = environment.AI_PLAYER_MODEL ?? environment.QWEN_MODEL
  if (!apiKey || !baseUrl || !model) {
    throw new PlayerDecisionProviderError('PROVIDER_NOT_CONFIGURED')
  }
  const parsedTimeout = Number(environment.AI_PLAYER_TIMEOUT_MS)
  return {
    provider,
    apiKey,
    baseUrl,
    model,
    timeoutMs:
      Number.isSafeInteger(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : DEFAULT_TIMEOUT_MS,
  }
}

function completionUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '')
  return normalized.endsWith('/chat/completions')
    ? normalized
    : `${normalized}/chat/completions`
}

function toPlayerAction(
  decision: z.infer<typeof modelDecisionSchema>,
  actorView: PokerActorView,
): PlayerAction {
  const legal = actorView.legalActions
  if (legal === null) {
    throw new PlayerDecisionProviderError('NO_LEGAL_ACTIONS')
  }
  if (decision.type === 'FOLD' || decision.type === 'CHECK') {
    return { type: decision.type }
  }
  if (decision.type === 'CALL' && legal.callTo !== null) {
    return { type: 'CALL', to: legal.callTo }
  }
  if (decision.type === 'ALL_IN') {
    return { type: 'ALL_IN', to: legal.maxTo }
  }
  if (decision.to === null) {
    throw new PlayerDecisionProviderError('INVALID_ACTION_SHAPE')
  }
  return { type: decision.type, to: decision.to }
}

function allowedActions(actorView: PokerActorView): Record<string, unknown>[] {
  const legal = actorView.legalActions
  if (legal === null) return []
  const actions: Record<string, unknown>[] = []
  if (legal.canFold) actions.push({ type: 'FOLD', to: null })
  if (legal.canCheck) actions.push({ type: 'CHECK', to: null })
  if (legal.canCall && legal.callTo !== null) {
    actions.push({ type: 'CALL', to: legal.callTo })
  }
  if (legal.canBet && legal.minBetTo !== null) {
    actions.push({ type: 'BET', minTo: legal.minBetTo, maxTo: legal.maxTo })
  }
  if (legal.canRaise && legal.minRaiseTo !== null) {
    actions.push({
      type: 'RAISE',
      minTo: legal.minRaiseTo,
      maxTo: legal.maxTo,
    })
  }
  if (legal.canAllIn) actions.push({ type: 'ALL_IN', to: legal.maxTo })
  return actions
}

function assertLegalAction(
  action: PlayerAction,
  actorView: PokerActorView,
): void {
  const legal = actorView.legalActions
  if (legal === null) {
    throw new PlayerDecisionProviderError('NO_LEGAL_ACTIONS')
  }
  const accepted =
    (action.type === 'FOLD' && legal.canFold) ||
    (action.type === 'CHECK' && legal.canCheck) ||
    (action.type === 'CALL' &&
      legal.canCall &&
      legal.callTo !== null &&
      action.to === legal.callTo) ||
    (action.type === 'BET' &&
      legal.canBet &&
      legal.minBetTo !== null &&
      action.to >= legal.minBetTo &&
      action.to <= legal.maxTo) ||
    (action.type === 'RAISE' &&
      legal.canRaise &&
      legal.minRaiseTo !== null &&
      action.to >= legal.minRaiseTo &&
      action.to <= legal.maxTo) ||
    (action.type === 'ALL_IN' && legal.canAllIn && action.to === legal.maxTo)
  if (!accepted) {
    throw new PlayerDecisionProviderError('ILLEGAL_ACTION')
  }
}

function priorDecision(
  input: PlayerDecisionInput,
  source: 'PRIOR' | 'FALLBACK',
  fallbackReason?: string,
  attemptedModel?: string,
  latencyMs?: number,
): AuditedPlayerDecision {
  const prior = chooseProfileBotAction(input)
  return {
    ...prior,
    provider: source === 'PRIOR' ? 'prior' : 'qwen',
    model: attemptedModel ?? 'persona-prior-v1',
    source,
    promptVersion: PROMPT_VERSION,
    validation: {
      acceptedByRuleEngine: true,
      ...(fallbackReason === undefined ? {} : { fallbackReason }),
    },
    ...(latencyMs === undefined ? {} : { latencyMs }),
  }
}

async function qwenDecision(
  input: PlayerDecisionInput,
  config: ProviderConfig,
  fetchImpl: typeof fetch,
): Promise<AuditedPlayerDecision> {
  const startedAt = performance.now()
  const elapsed = () => Math.max(0, Math.round(performance.now() - startedAt))
  let response: Response
  try {
    response = await fetchImpl(completionUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content:
              '你正在模拟固定熟人局中的一名德州扑克玩家。只能基于提供的行动者视图、公开行动和人物画像决策。按照 JSON Schema 输出，不要解释规则，不要输出隐藏推理。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: '选择一个当前合法行动，以符合该玩家画像的方式进行模拟。',
              actorId: input.actorId,
              heroId: input.heroId,
              players: input.players,
              profile: input.profile,
              actorView: input.actorView,
              allowedActions: allowedActions(input.actorView),
              instruction:
                'type 必须来自 allowedActions。CALL 与 ALL_IN 必须使用给定的精确 to；BET 与 RAISE 的 to 必须在 minTo 与 maxTo 之间；FOLD 与 CHECK 的 to 必须为 null。',
              recentPublicEvents: input.publicEvents.slice(-12),
            }),
          },
        ],
        enable_thinking: false,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'poker_player_decision',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'to', 'reason'],
              properties: {
                type: {
                  type: 'string',
                  enum: ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'],
                },
                to: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
                reason: { type: 'string', minLength: 1, maxLength: 300 },
              },
            },
          },
        },
        max_tokens: 220,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    })
  } catch (error) {
    throw new PlayerDecisionProviderError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'TIMEOUT'
        : 'NETWORK_ERROR',
      elapsed(),
    )
  }
  if (!response.ok) {
    throw new PlayerDecisionProviderError(`HTTP_${response.status}`, elapsed())
  }

  const completion = completionSchema.safeParse(
    await response.json().catch(() => null),
  )
  if (!completion.success) {
    throw new PlayerDecisionProviderError(
      'INVALID_PROVIDER_RESPONSE',
      elapsed(),
    )
  }
  const content = completion.data.choices[0]?.message.content
  let decoded: unknown
  try {
    decoded = JSON.parse(content ?? 'null') as unknown
  } catch {
    throw new PlayerDecisionProviderError('INVALID_MODEL_JSON', elapsed())
  }
  const parsedDecision = modelDecisionSchema.safeParse(decoded)
  if (!parsedDecision.success) {
    throw new PlayerDecisionProviderError('INVALID_MODEL_OUTPUT', elapsed())
  }
  let action: PlayerAction
  try {
    action = toPlayerAction(parsedDecision.data, input.actorView)
    assertLegalAction(action, input.actorView)
  } catch (error) {
    if (error instanceof PlayerDecisionProviderError) {
      throw new PlayerDecisionProviderError(error.code, elapsed())
    }
    throw error
  }

  return {
    action,
    reason: parsedDecision.data.reason,
    features: { modelSelected: true },
    provider: config.provider,
    model: config.model,
    source: 'LLM',
    promptVersion: PROMPT_VERSION,
    validation: {
      schemaValid: true,
      legalAction: true,
      acceptedByRuleEngine: true,
    },
    latencyMs: elapsed(),
    inputTokens: completion.data.usage?.prompt_tokens,
    outputTokens: completion.data.usage?.completion_tokens,
  }
}

export async function chooseAuditedPlayerAction(
  input: PlayerDecisionInput,
  dependencies: ProviderDependencies = {},
): Promise<AuditedPlayerDecision> {
  if (dependencies.allowLlm === false) return priorDecision(input, 'PRIOR')
  let config: ProviderConfig | null
  try {
    config = configuredProvider(dependencies.environment ?? process.env)
  } catch (error) {
    return priorDecision(
      input,
      'FALLBACK',
      error instanceof PlayerDecisionProviderError
        ? error.code
        : 'CONFIGURATION_ERROR',
    )
  }
  if (config === null) return priorDecision(input, 'PRIOR')

  try {
    return await qwenDecision(input, config, dependencies.fetchImpl ?? fetch)
  } catch (error) {
    return priorDecision(
      input,
      'FALLBACK',
      error instanceof PlayerDecisionProviderError
        ? error.code
        : 'UNKNOWN_PROVIDER_ERROR',
      config.model,
      error instanceof PlayerDecisionProviderError
        ? error.latencyMs
        : undefined,
    )
  }
}
