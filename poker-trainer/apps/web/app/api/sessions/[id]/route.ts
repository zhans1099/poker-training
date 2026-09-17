import { GameRepository } from '@poker-trainer/database'
import { NextResponse } from 'next/server'
import { gameApiError } from '../../../../lib/game-api-error'

export const runtime = 'nodejs'
const repository = new GameRepository()

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await repository.findSession((await context.params).id)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } },
        { status: 404 },
      )
    }
    return NextResponse.json({ data: session })
  } catch (error) {
    return gameApiError(error)
  }
}
