import type { Prisma } from './generated/prisma/client'
import { getPrisma } from './client'

export class PlayerNotFoundError extends Error {
  override readonly name = 'PlayerNotFoundError'
}

export class ProfileVersionConflictError extends Error {
  override readonly name = 'ProfileVersionConflictError'
}

export class ProfileFeedbackConflictError extends Error {
  override readonly name = 'ProfileFeedbackConflictError'
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

export function appendProfileObservation(
  profile: Record<string, unknown>,
  observation: string,
) {
  const existingNotes = typeof profile.notes === 'string' ? profile.notes : ''
  return {
    ...profile,
    notes: [existingNotes, `【复盘校准】${observation}`]
      .filter(Boolean)
      .join('\n'),
  }
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

  async createReviewFeedbacks(
    handId: string,
    sourceHandRef: string,
    observations: Array<{
      playerId: string
      observation: string
      confidence: number
    }>,
  ) {
    if (observations.length === 0) return []
    return getPrisma().$transaction(
      observations.map((observation) =>
        getPrisma().profileFeedback.create({
          data: {
            handId,
            sourceHandRef,
            playerId: observation.playerId,
            sentiment: 'LIKE_PLAYER',
            trait: 'deepseek-hand-observation',
            observation: observation.observation,
            confidence: observation.confidence,
          },
        }),
      ),
    )
  }

  async listHandFeedback(handId: string) {
    return getPrisma().profileFeedback.findMany({
      where: { handId },
      include: {
        player: { select: { id: true, code: true, displayName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
  }

  async resolveFeedback(
    playerId: string,
    feedbackId: string,
    resolution: 'ACCEPT' | 'REJECT',
  ) {
    const prisma = getPrisma()
    return prisma.$transaction(
      async (transaction) => {
        const feedback = await transaction.profileFeedback.findFirst({
          where: { id: feedbackId, playerId },
        })
        if (!feedback) throw new PlayerNotFoundError('Feedback not found')
        if (feedback.status !== 'PENDING') {
          throw new ProfileFeedbackConflictError('Feedback is already resolved')
        }

        if (resolution === 'REJECT') {
          return transaction.profileFeedback.update({
            where: { id: feedback.id },
            data: { status: 'REJECTED', resolvedAt: new Date() },
          })
        }

        const player = await transaction.player.findUnique({
          where: { id: playerId },
          include: { activeProfileVersion: true },
        })
        if (!player?.activeProfileVersion) {
          throw new PlayerNotFoundError('Player profile not found')
        }
        const currentProfile = player.activeProfileVersion.profile
        if (
          typeof currentProfile !== 'object' ||
          currentProfile === null ||
          Array.isArray(currentProfile)
        ) {
          throw new ProfileVersionConflictError('Active profile is invalid')
        }
        const latest = await transaction.profileVersion.findFirst({
          where: { playerId },
          orderBy: { version: 'desc' },
          select: { version: true },
        })
        const profile = appendProfileObservation(
          currentProfile,
          feedback.observation,
        )
        const profileVersion = await transaction.profileVersion.create({
          data: {
            playerId,
            version: (latest?.version ?? 0) + 1,
            label: '复盘反馈确认',
            source: 'USER_CONFIRMED',
            profile,
          },
        })
        await transaction.player.update({
          where: { id: playerId },
          data: { activeProfileVersionId: profileVersion.id },
        })
        return transaction.profileFeedback.update({
          where: { id: feedback.id },
          data: {
            status: 'ACCEPTED',
            appliedProfileVersionId: profileVersion.id,
            resolvedAt: new Date(),
          },
        })
      },
      { isolationLevel: 'Serializable' },
    )
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
