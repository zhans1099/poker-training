import {
  DatabaseConfigurationError,
  OpponentReadRepository,
} from '@poker-trainer/database'
import { upsertOpponentReadSchema } from '@poker-trainer/schemas'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
const repository = new OpponentReadRepository()

function handleError(error: unknown) {
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
    error.code === 'P2003'
  ) {
    return NextResponse.json(
      {
        error: {
          code: 'PLAYER_OR_SESSION_NOT_FOUND',
          message: 'Player or session not found',
        },
      },
      { status: 404 },
    )
  }
  console.error('Opponent read API failed', error)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    { status: 500 },
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const observerId = url.searchParams.get('observerId')
  const subjectId = url.searchParams.get('subjectId')
  const scopeKey = url.searchParams.get('scopeKey')
  try {
    const reads = await repository.list({
      ...(observerId === null ? {} : { observerId }),
      ...(subjectId === null ? {} : { subjectId }),
      ...(scopeKey === null ? {} : { scopeKey }),
    })
    return NextResponse.json({ data: reads })
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(request: Request) {
  const parsed = upsertOpponentReadSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  try {
    return NextResponse.json({ data: await repository.upsert(parsed.data) })
  } catch (error) {
    return handleError(error)
  }
}
