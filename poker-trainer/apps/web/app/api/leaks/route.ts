import { LeakRepository } from '@poker-trainer/database'
import { NextResponse } from 'next/server'
import { gameApiError } from '../../../lib/game-api-error'

export const runtime = 'nodejs'
const repository = new LeakRepository()

export async function GET() {
  try {
    return NextResponse.json({ data: await repository.dashboard() })
  } catch (error) {
    return gameApiError(error)
  }
}
