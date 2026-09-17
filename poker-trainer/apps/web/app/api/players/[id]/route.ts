import {
  DatabaseConfigurationError,
  PlayerRepository,
} from '@poker-trainer/database'
import { updatePlayerSchema } from '@poker-trainer/schemas'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const repository = new PlayerRepository()

interface RouteContext {
  params: Promise<{ id: string }>
}

function databaseError(error: unknown) {
  if (error instanceof DatabaseConfigurationError) {
    return NextResponse.json(
      { error: { code: 'DATABASE_NOT_CONFIGURED', message: error.message } },
      { status: 503 },
    )
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2025'
  ) {
    return NextResponse.json(
      { error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found' } },
      { status: 404 },
    )
  }
  console.error('Player API failed', error)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    { status: 500 },
  )
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const player = await repository.findById((await context.params).id)
    if (!player)
      return NextResponse.json(
        { error: { code: 'PLAYER_NOT_FOUND' } },
        { status: 404 },
      )
    return NextResponse.json({ data: player })
  } catch (error) {
    return databaseError(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const parsed = updatePlayerSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  try {
    const player = await repository.update(
      (await context.params).id,
      parsed.data,
    )
    return NextResponse.json({ data: player })
  } catch (error) {
    return databaseError(error)
  }
}
