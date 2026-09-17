import type { Prisma } from './generated/prisma/client'
import { getPrisma } from './client'

export interface UpsertOpponentReadRecord {
  observerId: string
  subjectId: string
  sessionId?: string | undefined
  scopeKey: string
  metrics: Record<string, unknown>
  confidence: number
  sampleCount: number
}

export class OpponentReadRepository {
  async list(filters: {
    observerId?: string
    subjectId?: string
    scopeKey?: string
  }) {
    return getPrisma().opponentRead.findMany({
      where: {
        ...(filters.observerId === undefined
          ? {}
          : { observerId: filters.observerId }),
        ...(filters.subjectId === undefined
          ? {}
          : { subjectId: filters.subjectId }),
        ...(filters.scopeKey === undefined
          ? {}
          : { scopeKey: filters.scopeKey }),
      },
      include: {
        observer: { select: { id: true, code: true, displayName: true } },
        subject: { select: { id: true, code: true, displayName: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 200,
    })
  }

  async upsert(input: UpsertOpponentReadRecord) {
    return getPrisma().opponentRead.upsert({
      where: {
        observerId_subjectId_scopeKey: {
          observerId: input.observerId,
          subjectId: input.subjectId,
          scopeKey: input.scopeKey,
        },
      },
      create: {
        observerId: input.observerId,
        subjectId: input.subjectId,
        scopeKey: input.scopeKey,
        metrics: input.metrics as Prisma.InputJsonValue,
        confidence: input.confidence,
        sampleCount: input.sampleCount,
        ...(input.sessionId === undefined
          ? {}
          : { sessionId: input.sessionId }),
      },
      update: {
        metrics: input.metrics as Prisma.InputJsonValue,
        confidence: input.confidence,
        sampleCount: input.sampleCount,
        ...(input.sessionId === undefined
          ? {}
          : { sessionId: input.sessionId }),
      },
    })
  }
}
