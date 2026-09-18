import {
  DatabaseConfigurationError,
  PlayerNotFoundError,
  ProfileFeedbackConflictError,
  ProfileRepository,
  ProfileVersionConflictError,
} from '@poker-trainer/database'
import { resolveProfileFeedbackSchema } from '@poker-trainer/schemas'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
const repository = new ProfileRepository()

interface RouteContext {
  params: Promise<{ id: string; feedbackId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const parsed = resolveProfileFeedbackSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  try {
    const { id, feedbackId } = await context.params
    return NextResponse.json({
      data: await repository.resolveFeedback(
        id,
        feedbackId,
        parsed.data.resolution,
      ),
    })
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return NextResponse.json(
        { error: { code: 'DATABASE_NOT_CONFIGURED', message: error.message } },
        { status: 503 },
      )
    }
    if (error instanceof PlayerNotFoundError) {
      return NextResponse.json(
        { error: { code: 'FEEDBACK_NOT_FOUND', message: error.message } },
        { status: 404 },
      )
    }
    if (
      error instanceof ProfileFeedbackConflictError ||
      error instanceof ProfileVersionConflictError
    ) {
      return NextResponse.json(
        {
          error: { code: 'PROFILE_FEEDBACK_CONFLICT', message: error.message },
        },
        { status: 409 },
      )
    }
    console.error('Profile feedback resolution failed', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
      { status: 500 },
    )
  }
}
