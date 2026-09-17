import type { Prisma } from './generated/prisma/client'
import { getPrisma } from './client'

export interface CreatePlayerRecord {
  code: string
  displayName: string
  kind: 'HERO' | 'OPPONENT'
  profile: Record<string, unknown>
  profileLabel?: string | undefined
}

export interface UpdatePlayerRecord {
  displayName?: string | undefined
  enabled?: boolean | undefined
}

export class PlayerRepository {
  async list(includeDisabled = false) {
    return getPrisma().player.findMany({
      ...(includeDisabled ? {} : { where: { enabled: true } }),
      include: { activeProfileVersion: true },
      orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async findById(id: string) {
    return getPrisma().player.findUnique({
      where: { id },
      include: {
        activeProfileVersion: true,
        profileVersions: { orderBy: { version: 'desc' } },
      },
    })
  }

  async create(input: CreatePlayerRecord) {
    const prisma = getPrisma()
    return prisma.$transaction(async (transaction) => {
      const player = await transaction.player.create({
        data: {
          code: input.code,
          displayName: input.displayName,
          kind: input.kind,
        },
      })
      const profileVersion = await transaction.profileVersion.create({
        data: {
          playerId: player.id,
          version: 1,
          label: input.profileLabel ?? null,
          profile: input.profile as Prisma.InputJsonValue,
        },
      })
      return transaction.player.update({
        where: { id: player.id },
        data: { activeProfileVersionId: profileVersion.id },
        include: { activeProfileVersion: true },
      })
    })
  }

  async update(id: string, input: UpdatePlayerRecord) {
    return getPrisma().player.update({
      where: { id },
      data: {
        ...(input.displayName === undefined
          ? {}
          : { displayName: input.displayName }),
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
      },
      include: { activeProfileVersion: true },
    })
  }
}
