import { GameRepository } from '@poker-trainer/database'
import { createTrainingSessionSchema } from '@poker-trainer/schemas'
import { NextResponse } from 'next/server'
import { gameApiError } from '../../../lib/game-api-error'

export const runtime = 'nodejs'
const repository = new GameRepository()

export async function GET() {
  try {
    return NextResponse.json({ data: await repository.listSessions() })
  } catch (error) {
    return gameApiError(error)
  }
}

export async function POST(request: Request) {
  const parsed = createTrainingSessionSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  try {
    const session = await repository.createSession(parsed.data)
    return NextResponse.json({ data: session }, { status: 201 })
  } catch (error) {
    return gameApiError(error)
  }
}
