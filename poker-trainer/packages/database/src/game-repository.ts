import type { Prisma } from './generated/prisma/client'
import { getPrisma } from './client'

export class SessionNotFoundError extends Error {
  override readonly name = 'SessionNotFoundError'
}

export class SessionStateError extends Error {
  override readonly name = 'SessionStateError'
}

export class ParticipantValidationError extends Error {
  override readonly name = 'ParticipantValidationError'
}

export class HandNotFoundError extends Error {
  override readonly name = 'HandNotFoundError'
}

export class HandStateError extends Error {
  override readonly name = 'HandStateError'
}

export class HandVersionConflictError extends Error {
  override readonly name = 'HandVersionConflictError'
}

export interface CreateTrainingSessionRecord {
  tableSize: number
  smallBlind: number
  bigBlind: number
  startingStack: number
  config?: Record<string, unknown> | undefined
  participants: Array<{
    playerId: string
    seatNo: number
    stack?: number | undefined
  }>
}

export interface CreateHandRecord {
  buttonSeat: number
  seedHash: string
  stateHash: string
  state: Record<string, unknown>
  holeCardsByPlayerId: Readonly<Record<string, readonly string[]>>
  seatNoByPlayerId: Readonly<Record<string, number>>
  initialEventPayload: Record<string, unknown>
}

export interface AppendHandEventRecord {
  expectedVersion: number
  commandId: string
  eventType: string
  actorId?: string | undefined
  payload: Record<string, unknown>
  stateHash: string
  nextState: Record<string, unknown>
  handStatus: 'ACTIVE' | 'FROZEN' | 'COMPLETED'
  result?: Record<string, unknown> | undefined
  endingStacks?: Readonly<Record<string, number>> | undefined
  heroDecision?:
    | {
        heroId: string
        actorView: Record<string, unknown>
        thoughtInput?: Record<string, unknown> | undefined
        legalActions: Record<string, unknown>
        chosenAction: Record<string, unknown>
      }
    | undefined
  aiDecision?:
    | {
        playerId: string
        profileVersionId: string
        provider: string
        model: string
        source: 'PRIOR' | 'LLM' | 'FALLBACK'
        promptVersion: string
        actorView: Record<string, unknown>
        output: Record<string, unknown>
        validation?: Record<string, unknown> | undefined
        latencyMs?: number | undefined
        inputTokens?: number | undefined
        outputTokens?: number | undefined
      }
    | undefined
}

export interface CreateHandReviewRecord {
  provider: string
  model: string
  promptVersion: string
  review: Record<string, unknown>
}

const sessionInclude = {
  participants: {
    include: {
      player: {
        include: { activeProfileVersion: true },
      },
    },
    orderBy: { seatNo: 'asc' as const },
  },
} satisfies Prisma.TrainingSessionInclude

const handInclude = {
  participants: {
    include: { player: true, profileVersion: true },
    orderBy: { seatNo: 'asc' as const },
  },
  events: { orderBy: { sequenceNo: 'asc' as const } },
} satisfies Prisma.HandInclude

export class GameRepository {
  async listSessions() {
    return getPrisma().trainingSession.findMany({
      include: sessionInclude,
      orderBy: { startedAt: 'desc' },
      take: 100,
    })
  }

  async findSession(id: string) {
    return getPrisma().trainingSession.findUnique({
      where: { id },
      include: {
        ...sessionInclude,
        hands: {
          select: {
            id: true,
            handNo: true,
            status: true,
            version: true,
            buttonSeat: true,
            startedAt: true,
            completedAt: true,
          },
          orderBy: { handNo: 'desc' },
          take: 100,
        },
      },
    })
  }

  async createSession(input: CreateTrainingSessionRecord) {
    const prisma = getPrisma()
    return prisma.$transaction(
      async (transaction) => {
        const participantIds = input.participants.map(
          (participant) => participant.playerId,
        )
        const players = await transaction.player.findMany({
          where: { id: { in: participantIds }, enabled: true },
          select: { id: true, kind: true, activeProfileVersionId: true },
        })
        if (players.length !== participantIds.length) {
          throw new ParticipantValidationError(
            'Every participant must exist and be enabled',
          )
        }
        if (players.filter((player) => player.kind === 'HERO').length !== 1) {
          throw new ParticipantValidationError(
            'A training session must contain exactly one Hero',
          )
        }
        if (players.some((player) => player.activeProfileVersionId === null)) {
          throw new ParticipantValidationError(
            'Every participant must have an active profile version',
          )
        }

        return transaction.trainingSession.create({
          data: {
            tableSize: input.tableSize,
            smallBlind: input.smallBlind,
            bigBlind: input.bigBlind,
            startingStack: input.startingStack,
            ...(input.config === undefined
              ? {}
              : { config: input.config as Prisma.InputJsonValue }),
            participants: {
              create: input.participants.map((participant) => ({
                playerId: participant.playerId,
                seatNo: participant.seatNo,
                stack: participant.stack ?? input.startingStack,
                state: {
                  tiltLevel: 0,
                  confidenceLevel: 0.5,
                  sessionProfitLoss: 0,
                  recentLossCount: 0,
                  recentWinCount: 0,
                  rebuyCount: 0,
                  version: 0,
                },
              })),
            },
          },
          include: sessionInclude,
        })
      },
      { isolationLevel: 'Serializable' },
    )
  }

  async findHand(id: string) {
    return getPrisma().hand.findUnique({
      where: { id },
      include: handInclude,
    })
  }

  async findHandByNumber(sessionId: string, handNo: number) {
    return getPrisma().hand.findUnique({
      where: { sessionId_handNo: { sessionId, handNo } },
      include: handInclude,
    })
  }

  async findHandForReview(id: string) {
    return getPrisma().hand.findUnique({
      where: { id },
      include: {
        ...handInclude,
        decisions: { orderBy: { eventSequence: 'asc' } },
        reviews: { orderBy: { version: 'desc' } },
      },
    })
  }

  async createHandReview(handId: string, input: CreateHandReviewRecord) {
    return getPrisma().$transaction(
      async (transaction) => {
        const hand = await transaction.hand.findUnique({
          where: { id: handId },
          select: { status: true },
        })
        if (!hand) throw new HandNotFoundError('Hand not found')
        if (hand.status !== 'COMPLETED') {
          throw new HandStateError('Only a completed hand can be reviewed')
        }
        const latest = await transaction.handReview.findFirst({
          where: { handId },
          select: { version: true },
          orderBy: { version: 'desc' },
        })
        return transaction.handReview.create({
          data: {
            handId,
            version: (latest?.version ?? 0) + 1,
            provider: input.provider,
            model: input.model,
            promptVersion: input.promptVersion,
            review: input.review as Prisma.InputJsonValue,
          },
        })
      },
      { isolationLevel: 'Serializable' },
    )
  }

  async findEventByCommand(handId: string, commandId: string) {
    return getPrisma().handEvent.findUnique({
      where: { handId_commandId: { handId, commandId } },
    })
  }

  async createHand(sessionId: string, input: CreateHandRecord) {
    const prisma = getPrisma()
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const session = await transaction.trainingSession.findUnique({
            where: { id: sessionId },
            include: sessionInclude,
          })
          if (!session) throw new SessionNotFoundError('Session not found')
          if (session.status !== 'ACTIVE') {
            throw new SessionStateError('Session is not active')
          }
          if (
            !session.participants.some(
              (participant) => participant.seatNo === input.buttonSeat,
            )
          ) {
            throw new ParticipantValidationError(
              'buttonSeat must belong to a session participant',
            )
          }
          if (
            session.participants.some(
              (participant) =>
                participant.player.activeProfileVersionId === null,
            )
          ) {
            throw new ParticipantValidationError(
              'Every participant must have an active profile version',
            )
          }

          const latestHand = await transaction.hand.findFirst({
            where: { sessionId },
            select: { handNo: true, status: true },
            orderBy: { handNo: 'desc' },
          })
          if (latestHand !== null && latestHand.status !== 'COMPLETED') {
            throw new SessionStateError(
              'The previous hand must be completed before starting another',
            )
          }

          return transaction.hand.create({
            data: {
              sessionId,
              handNo: (latestHand?.handNo ?? 0) + 1,
              seedHash: input.seedHash,
              buttonSeat: input.buttonSeat,
              version: 1,
              stateHash: input.stateHash,
              state: input.state as Prisma.InputJsonValue,
              participants: {
                create: session.participants.map((participant) => ({
                  playerId: participant.playerId,
                  profileVersionId: participant.player
                    .activeProfileVersionId as string,
                  seatNo:
                    input.seatNoByPlayerId[participant.playerId] ??
                    participant.seatNo,
                  startingStack: participant.stack,
                  holeCards:
                    input.holeCardsByPlayerId[participant.playerId] ?? [],
                })),
              },
              events: {
                create: {
                  sequenceNo: 1,
                  eventType: 'HAND_STARTED',
                  payload: input.initialEventPayload as Prisma.InputJsonValue,
                },
              },
            },
            include: handInclude,
          })
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (error) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : null
      if (code === 'P2002' || code === 'P2034') {
        throw new SessionStateError(
          'Another request created or is creating the next hand',
        )
      }
      throw error
    }
  }

  async appendEvent(handId: string, input: AppendHandEventRecord) {
    const prisma = getPrisma()
    return prisma.$transaction(
      async (transaction) => {
        const previousReceipt = await transaction.handEvent.findUnique({
          where: {
            handId_commandId: { handId, commandId: input.commandId },
          },
        })
        if (previousReceipt) {
          return {
            event: previousReceipt,
            handVersion: previousReceipt.sequenceNo,
            idempotentReplay: true,
          }
        }

        const hand = await transaction.hand.findUnique({
          where: { id: handId },
          include: { participants: { select: { playerId: true } } },
        })
        if (!hand) throw new HandNotFoundError('Hand not found')
        if (hand.status !== 'ACTIVE') {
          throw new HandStateError('Hand is not active')
        }
        if (hand.version !== input.expectedVersion) {
          throw new HandVersionConflictError(
            `Expected hand version ${input.expectedVersion}, current version is ${hand.version}`,
          )
        }
        if (
          input.actorId !== undefined &&
          !hand.participants.some(
            (participant) => participant.playerId === input.actorId,
          )
        ) {
          throw new ParticipantValidationError(
            'Event actor must be a hand participant',
          )
        }

        const nextVersion = hand.version + 1
        const updateResult = await transaction.hand.updateMany({
          where: { id: handId, version: input.expectedVersion },
          data: {
            version: { increment: 1 },
            stateHash: input.stateHash,
            state: input.nextState as Prisma.InputJsonValue,
            status: input.handStatus,
            ...(input.result === undefined
              ? {}
              : { result: input.result as Prisma.InputJsonValue }),
            ...(input.handStatus === 'COMPLETED'
              ? { completedAt: new Date() }
              : {}),
          },
        })
        if (updateResult.count !== 1) {
          throw new HandVersionConflictError(
            'Hand version changed while appending the event',
          )
        }

        const event = await transaction.handEvent.create({
          data: {
            handId,
            sequenceNo: nextVersion,
            eventType: input.eventType,
            commandId: input.commandId,
            ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
            payload: input.payload as Prisma.InputJsonValue,
          },
        })

        if (input.heroDecision !== undefined) {
          await transaction.heroDecision.create({
            data: {
              handId,
              heroId: input.heroDecision.heroId,
              eventSequence: nextVersion,
              actorView: input.heroDecision.actorView as Prisma.InputJsonValue,
              ...(input.heroDecision.thoughtInput === undefined
                ? {}
                : {
                    thoughtInput: input.heroDecision
                      .thoughtInput as Prisma.InputJsonValue,
                  }),
              legalActions: input.heroDecision
                .legalActions as Prisma.InputJsonValue,
              chosenAction: input.heroDecision
                .chosenAction as Prisma.InputJsonValue,
            },
          })
        }

        if (input.aiDecision !== undefined) {
          await transaction.aiDecision.create({
            data: {
              handId,
              playerId: input.aiDecision.playerId,
              profileVersionId: input.aiDecision.profileVersionId,
              eventSequence: nextVersion,
              provider: input.aiDecision.provider,
              model: input.aiDecision.model,
              source: input.aiDecision.source,
              promptVersion: input.aiDecision.promptVersion,
              actorView: input.aiDecision.actorView as Prisma.InputJsonValue,
              output: input.aiDecision.output as Prisma.InputJsonValue,
              ...(input.aiDecision.validation === undefined
                ? {}
                : {
                    validation: input.aiDecision
                      .validation as Prisma.InputJsonValue,
                  }),
              ...(input.aiDecision.latencyMs === undefined
                ? {}
                : { latencyMs: input.aiDecision.latencyMs }),
              ...(input.aiDecision.inputTokens === undefined
                ? {}
                : { inputTokens: input.aiDecision.inputTokens }),
              ...(input.aiDecision.outputTokens === undefined
                ? {}
                : { outputTokens: input.aiDecision.outputTokens }),
            },
          })
        }

        if (input.endingStacks !== undefined) {
          for (const [playerId, stack] of Object.entries(input.endingStacks)) {
            await transaction.handParticipant.updateMany({
              where: { handId, playerId },
              data: { endingStack: stack },
            })
            await transaction.sessionParticipant.updateMany({
              where: { sessionId: hand.sessionId, playerId },
              data: { stack },
            })
          }
        }
        return { event, handVersion: nextVersion, idempotentReplay: false }
      },
      { isolationLevel: 'Serializable' },
    )
  }
}
