import type { Prisma } from './generated/prisma/client'
import { getPrisma } from './client'

export class PlayerNotFoundError extends Error {
  override readonly name = 'PlayerNotFoundError'
}

export class ProfileVersionConflictError extends Error {
  override readonly name = 'ProfileVersionConflictError'
}

export interface CreateFeedbackRecord {
  handId?: string | undefined
  sourceHandRef?: string | undefined
  sentiment: 'LIKE_PLAYER' | 'UNLIKE_PLAYER' | 'CORRECTION'
  trait?: string | undefined
  observation: string
  observedAction?: Record<string, unknown> | undefined
  proposedPatch?: Record<string, unknown> | undefined
  confidence: number
}

export interface CreateProfileVersionRecord {
  profile: Record<string, unknown>
  label?: string | undefined
  source: string
  expectedActiveVersionId?: string | null | undefined
  feedbackIds: string[]
  activate: boolean
}

export class ProfileRepository {
  async listFeedback(playerId: string) {
    return getPrisma().profileFeedback.findMany({
      where: { playerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })
  }

  async createFeedback(playerId: string, input: CreateFeedbackRecord) {
    return getPrisma().profileFeedback.create({
      data: {
        playerId,
        sentiment: input.sentiment,
        observation: input.observation,
        confidence: input.confidence,
        ...(input.handId === undefined ? {} : { handId: input.handId }),
        ...(input.sourceHandRef === undefined
          ? {}
          : { sourceHandRef: input.sourceHandRef }),
        ...(input.trait === undefined ? {} : { trait: input.trait }),
        ...(input.observedAction === undefined
          ? {}
          : {
              observedAction: input.observedAction as Prisma.InputJsonValue,
            }),
        ...(input.proposedPatch === undefined
          ? {}
          : { proposedPatch: input.proposedPatch as Prisma.InputJsonValue }),
      },
    })
  }

  async createVersion(playerId: string, input: CreateProfileVersionRecord) {
    const prisma = getPrisma()
    return prisma.$transaction(
      async (transaction) => {
        const player = await transaction.player.findUnique({
          where: { id: playerId },
        })
        if (!player) throw new PlayerNotFoundError('Player not found')

        if (
          input.expectedActiveVersionId !== undefined &&
          input.expectedActiveVersionId !== player.activeProfileVersionId
        ) {
          throw new ProfileVersionConflictError(
            'Active profile changed before this update',
          )
        }

        const latest = await transaction.profileVersion.findFirst({
          where: { playerId },
          orderBy: { version: 'desc' },
          select: { version: true },
        })

        if (input.feedbackIds.length > 0) {
          const matchingFeedback = await transaction.profileFeedback.count({
            where: {
              id: { in: input.feedbackIds },
              playerId,
              status: 'PENDING',
            },
          })
          if (matchingFeedback !== input.feedbackIds.length) {
            throw new ProfileVersionConflictError(
              'Some feedback is missing or already resolved',
            )
          }
        }

        const profileVersion = await transaction.profileVersion.create({
          data: {
            playerId,
            version: (latest?.version ?? 0) + 1,
            label: input.label ?? null,
            source: input.source,
            profile: input.profile as Prisma.InputJsonValue,
          },
        })

        if (input.activate) {
          await transaction.player.update({
            where: { id: playerId },
            data: { activeProfileVersionId: profileVersion.id },
          })
        }

        if (input.feedbackIds.length > 0) {
          await transaction.profileFeedback.updateMany({
            where: {
              id: { in: input.feedbackIds },
              playerId,
              status: 'PENDING',
            },
            data: {
              status: 'ACCEPTED',
              appliedProfileVersionId: profileVersion.id,
              resolvedAt: new Date(),
            },
          })
        }

        return profileVersion
      },
      { isolationLevel: 'Serializable' },
    )
  }
}
