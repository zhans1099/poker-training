import { z } from 'zod'

const chipsSchema = z.number().int().nonnegative().safe()

export const cardSchema = z.string().regex(/^(?:[2-9TJQKA])[cdhs]$/)

export const playerActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('FOLD') }).strict(),
  z.object({ type: z.literal('CHECK') }).strict(),
  z.object({ type: z.literal('CALL'), to: chipsSchema }).strict(),
  z.object({ type: z.literal('BET'), to: chipsSchema }).strict(),
  z.object({ type: z.literal('RAISE'), to: chipsSchema }).strict(),
  z.object({ type: z.literal('ALL_IN'), to: chipsSchema }).strict(),
])

export const probabilitySchema = z.number().min(0).max(1)

export type PlayerActionInput = z.infer<typeof playerActionSchema>

export const createPlayerSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9_-]+$/),
    displayName: z.string().trim().min(1).max(80),
    kind: z.enum(['HERO', 'OPPONENT']).default('OPPONENT'),
    profile: z.record(z.string(), z.unknown()).default({}),
    profileLabel: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

export const updatePlayerSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required',
  )

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>

const jsonObjectSchema = z.record(z.string(), z.unknown())

export const createProfileFeedbackSchema = z
  .object({
    handId: z.string().trim().min(1).max(30).optional(),
    sourceHandRef: z.string().trim().min(1).max(80).optional(),
    sentiment: z.enum(['LIKE_PLAYER', 'UNLIKE_PLAYER', 'CORRECTION']),
    trait: z.string().trim().min(1).max(80).optional(),
    observation: z.string().trim().min(1).max(4000),
    observedAction: jsonObjectSchema.optional(),
    proposedPatch: jsonObjectSchema.optional(),
    confidence: z.number().min(0).max(1).default(0.5),
  })
  .strict()
  .refine(
    (value) => value.handId !== undefined || value.sourceHandRef !== undefined,
    { message: 'handId or sourceHandRef is required' },
  )

export const createProfileVersionSchema = z
  .object({
    profile: jsonObjectSchema,
    label: z.string().trim().min(1).max(120).optional(),
    source: z.string().trim().min(1).max(30).default('USER_CONFIRMED'),
    expectedActiveVersionId: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .nullable()
      .optional(),
    feedbackIds: z.array(z.string().trim().min(1).max(30)).max(100).default([]),
    activate: z.boolean().default(true),
  })
  .strict()

export const upsertOpponentReadSchema = z
  .object({
    observerId: z.string().trim().min(1).max(30),
    subjectId: z.string().trim().min(1).max(30),
    sessionId: z.string().trim().min(1).max(30).optional(),
    scopeKey: z.string().trim().min(1).max(40).default('GLOBAL'),
    metrics: jsonObjectSchema,
    confidence: z.number().min(0).max(1),
    sampleCount: z.number().int().nonnegative().default(0),
  })
  .strict()
  .refine((value) => value.observerId !== value.subjectId, {
    message: 'observerId and subjectId must be different',
  })

export type CreateProfileFeedbackInput = z.infer<
  typeof createProfileFeedbackSchema
>
export type CreateProfileVersionInput = z.infer<
  typeof createProfileVersionSchema
>
export type UpsertOpponentReadInput = z.infer<typeof upsertOpponentReadSchema>

const sessionParticipantSchema = z
  .object({
    playerId: z.string().trim().min(1).max(30),
    seatNo: z.number().int().min(1).max(6),
    stack: chipsSchema.positive().optional(),
  })
  .strict()

export const createTrainingSessionSchema = z
  .object({
    tableSize: z.union([z.literal(5), z.literal(6)]),
    smallBlind: chipsSchema.positive(),
    bigBlind: chipsSchema.positive(),
    startingStack: chipsSchema.positive(),
    config: jsonObjectSchema.optional(),
    participants: z.array(sessionParticipantSchema).min(2).max(6),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.bigBlind <= value.smallBlind) {
      context.addIssue({
        code: 'custom',
        path: ['bigBlind'],
        message: 'bigBlind must be greater than smallBlind',
      })
    }
    if (value.participants.length !== value.tableSize) {
      context.addIssue({
        code: 'custom',
        path: ['participants'],
        message: 'participants length must equal tableSize',
      })
    }
    if (
      new Set(value.participants.map((participant) => participant.playerId))
        .size !== value.participants.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['participants'],
        message: 'participant playerId values must be unique',
      })
    }
    if (
      new Set(value.participants.map((participant) => participant.seatNo))
        .size !== value.participants.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['participants'],
        message: 'participant seatNo values must be unique',
      })
    }
    for (const [index, participant] of value.participants.entries()) {
      if (participant.seatNo > value.tableSize) {
        context.addIssue({
          code: 'custom',
          path: ['participants', index, 'seatNo'],
          message: 'seatNo must not exceed tableSize',
        })
      }
    }
  })

export const createHandSchema = z
  .object({
    buttonSeat: z.number().int().min(1).max(6),
    randomizeSeats: z.boolean().default(false),
  })
  .strict()

const decisionNoteSchema = z.string().trim().max(4000).optional()
const rangeStrengthSchema = z.enum(['WEAK', 'MEDIUM', 'STRONG', 'NUTS'])
const actionPurposeSchema = z.enum([
  'BLUFF',
  'SEMI_BLUFF',
  'PROTECTION',
  'VALUE',
  'POT_CONTROL',
  'EQUITY_REALIZATION',
])

const quickThoughtInputSchema = z
  .object({
    mode: z.literal('QUICK'),
    note: decisionNoteSchema,
  })
  .strict()

const trainingThoughtFields = {
  note: decisionNoteSchema,
  rangeStrength: rangeStrengthSchema,
  purpose: actionPurposeSchema,
  potOddsEstimate: probabilitySchema,
  equityEstimate: probabilitySchema,
}

const trainingThoughtInputSchema = z
  .object({
    mode: z.literal('TRAINING'),
    ...trainingThoughtFields,
  })
  .strict()

const deepThoughtInputSchema = z
  .object({
    mode: z.literal('DEEP'),
    ...trainingThoughtFields,
    rangeCategory: z.string().trim().min(1).max(120),
    madeHandCategory: z.string().trim().min(1).max(120),
    comboEstimate: z.number().int().min(0).max(1326),
    blockers: z.array(cardSchema).max(4),
    outs: z.number().int().min(0).max(47),
    futurePlan: z.string().trim().min(1).max(2000),
    versusRaisePlan: z.string().trim().min(1).max(2000),
  })
  .strict()

export const heroThoughtInputSchema = z.discriminatedUnion('mode', [
  quickThoughtInputSchema,
  trainingThoughtInputSchema,
  deepThoughtInputSchema,
])

export const legalActionSetSchema = z
  .object({
    canFold: z.boolean(),
    canCheck: z.boolean(),
    callAmount: chipsSchema,
    callTo: chipsSchema.nullable(),
    canCall: z.boolean(),
    canBet: z.boolean(),
    canRaise: z.boolean(),
    canAllIn: z.boolean(),
    minBetTo: chipsSchema.nullable(),
    minRaiseTo: chipsSchema.nullable(),
    maxTo: chipsSchema,
    raiseRightsOpen: z.boolean(),
  })
  .strict()

const actorSeatViewSchema = z
  .object({
    seat: z.number().int().min(1).max(6),
    playerId: z.string(),
    stack: chipsSchema,
    status: z.enum(['ACTIVE', 'FOLDED', 'ALL_IN', 'SITTING_OUT']),
    committedThisStreet: chipsSchema,
    committedThisHand: chipsSchema,
    holeCards: z.array(cardSchema).length(2).nullable(),
  })
  .strict()

const pokerActorViewSchema = z
  .object({
    schemaVersion: z.literal(1),
    phase: z.enum(['BETTING', 'SHOWDOWN', 'COMPLETE']),
    street: z.enum(['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN']),
    buttonSeat: z.number().int().min(1).max(6),
    smallBlindSeat: z.number().int().min(1).max(6),
    bigBlindSeat: z.number().int().min(1).max(6),
    board: z.array(cardSchema).max(5),
    runoutBoards: z.array(z.array(cardSchema).length(5)),
    pot: chipsSchema,
    currentBet: chipsSchema,
    currentActorPlayerId: z.string().nullable(),
    seats: z.array(actorSeatViewSchema).min(2).max(6),
    legalActions: legalActionSetSchema.nullable(),
    result: z.unknown().nullable(),
  })
  .strict()

const publicHandEventSchema = z
  .object({
    id: z.string(),
    sequenceNo: z.number().int().positive(),
    eventType: z.string(),
    actorId: z.string().nullable(),
    createdAt: z.string(),
    payload: jsonObjectSchema,
  })
  .strict()

export const heroHandViewSchema = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    handNo: z.number().int().positive(),
    status: z.enum(['ACTIVE', 'FROZEN', 'COMPLETED']),
    version: z.number().int().nonnegative(),
    stateHash: z.string().nullable(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    players: z.array(
      z
        .object({
          playerId: z.string(),
          displayName: z.string(),
          kind: z.enum(['HERO', 'OPPONENT']),
          seatNo: z.number().int().min(1).max(6),
          profileVersion: z.number().int().positive(),
        })
        .strict(),
    ),
    events: z.array(publicHandEventSchema),
    view: pokerActorViewSchema,
  })
  .strict()

export const heroHandResponseSchema = z
  .object({ data: heroHandViewSchema })
  .strict()

export const playerListResponseSchema = z
  .object({
    data: z.array(
      z
        .object({
          id: z.string(),
          code: z.string(),
          displayName: z.string(),
          kind: z.enum(['HERO', 'OPPONENT']),
          enabled: z.boolean(),
          activeProfileVersionId: z.string().nullable(),
        })
        .passthrough(),
    ),
  })
  .strict()

export const createSessionResponseSchema = z
  .object({
    data: z.object({ id: z.string() }).passthrough(),
  })
  .strict()

export const submitHandActionResponseSchema = z
  .object({
    data: z
      .object({
        event: z.unknown(),
        idempotentReplay: z.boolean(),
        hand: heroHandViewSchema,
      })
      .strict(),
  })
  .strict()

export const submitHandActionSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    commandId: z
      .string()
      .trim()
      .min(8)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/),
    action: playerActionSchema,
    thoughtInput: heroThoughtInputSchema.optional(),
  })
  .strict()

export type CreateTrainingSessionInput = z.infer<
  typeof createTrainingSessionSchema
>
export type CreateHandInput = z.infer<typeof createHandSchema>
export type HeroThoughtInput = z.infer<typeof heroThoughtInputSchema>
export type HeroHandView = z.infer<typeof heroHandViewSchema>
export type PlayerListItem = z.infer<
  typeof playerListResponseSchema
>['data'][number]
export type SubmitHandActionInput = z.infer<typeof submitHandActionSchema>
