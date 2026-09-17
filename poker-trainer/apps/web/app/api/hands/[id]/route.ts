import { NextResponse } from 'next/server'
import { gameApiError } from '../../../../lib/game-api-error'
import { HandService } from '../../../../lib/hand-service'

export const runtime = 'nodejs'
const service = new HandService()

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const hand = await service.getForHero((await context.params).id)
    return NextResponse.json({ data: hand })
  } catch (error) {
    return gameApiError(error)
  }
}
