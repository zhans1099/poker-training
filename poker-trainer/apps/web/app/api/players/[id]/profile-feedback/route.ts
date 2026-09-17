import {
  DatabaseConfigurationError,
  ProfileRepository,
} from '@poker-trainer/database'
import { createProfileFeedbackSchema } from '@poker-trainer/schemas'
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
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2003'
  ) {
    return NextResponse.json(
      {
        error: {
          code: 'PLAYER_OR_HAND_NOT_FOUND',
          message: 'Player or hand not found',
        },
      },
      { status: 404 },
    )
  }
  console.error('Profile feedback API failed', error)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    { status: 500 },
  )
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    return NextResponse.json({
      data: await repository.listFeedback((await context.params).id),
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  const parsed = createProfileFeedbackSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  try {
    const feedback = await repository.createFeedback(
      (await context.params).id,
      parsed.data,
    )
    return NextResponse.json({ data: feedback }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
