import { ProfileRepository } from '@poker-trainer/database'
import { NextResponse } from 'next/server'
import { gameApiError } from '../../../../../lib/game-api-error'

export const runtime = 'nodejs'
const repository = new ProfileRepository()

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    return NextResponse.json({
      data: await repository.listHandFeedback((await context.params).id),
    })
  } catch (error) {
    return gameApiError(error)
  }
}
