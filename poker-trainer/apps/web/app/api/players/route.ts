import {
  DatabaseConfigurationError,
  PlayerRepository,
} from '@poker-trainer/database'
import { createPlayerSchema } from '@poker-trainer/schemas'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const repository = new PlayerRepository()

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
    error.code === 'P2002'
  ) {
    return NextResponse.json(
      {
        error: {
          code: 'PLAYER_CODE_EXISTS',
          message: 'Player code already exists',
        },
      },
      { status: 409 },
    )
  }
  console.error('Player API failed', error)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    { status: 500 },
  )
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const players = await repository.list(
      url.searchParams.get('includeDisabled') === 'true',
    )
    return NextResponse.json({ data: players })
  } catch (error) {
    return databaseError(error)
  }
}

export async function POST(request: Request) {
  const parsed = createPlayerSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  try {
    const player = await repository.create(parsed.data)
    return NextResponse.json({ data: player }, { status: 201 })
  } catch (error) {
    return databaseError(error)
  }
}
