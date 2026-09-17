import {
  DatabaseConfigurationError,
  PlayerNotFoundError,
  ProfileRepository,
  ProfileVersionConflictError,
} from '@poker-trainer/database'
import { createProfileVersionSchema } from '@poker-trainer/schemas'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
const repository = new ProfileRepository()

interface RouteContext {
  params: Promise<{ id: string }>
}

function handleError(error: unknown) {
  if (error instanceof DatabaseConfigurationError) {
    return NextResponse.json(
      { error: { code: 'DATABASE_NOT_CONFIGURED', message: error.message } },
      { status: 503 },
    )
  }
  if (error instanceof PlayerNotFoundError) {
    return NextResponse.json(
      { error: { code: 'PLAYER_NOT_FOUND', message: error.message } },
      { status: 404 },
    )
  }
  if (error instanceof ProfileVersionConflictError) {
    return NextResponse.json(
      { error: { code: 'PROFILE_VERSION_CONFLICT', message: error.message } },
      { status: 409 },
    )
  }
  console.error('Profile version API failed', error)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    { status: 500 },
  )
}

export async function POST(request: Request, context: RouteContext) {
  const parsed = createProfileVersionSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  try {
    const profileVersion = await repository.createVersion(
      (await context.params).id,
      parsed.data,
    )
    return NextResponse.json({ data: profileVersion }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
