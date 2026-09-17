import { createHandSchema } from '@poker-trainer/schemas'
import { NextResponse } from 'next/server'
import { gameApiError } from '../../../../../lib/game-api-error'
import { HandService } from '../../../../../lib/hand-service'

export const runtime = 'nodejs'
const service = new HandService()

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const parsed = createHandSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  try {
    const hand = await service.create((await context.params).id, parsed.data)
    return NextResponse.json({ data: hand }, { status: 201 })
  } catch (error) {
    return gameApiError(error)
  }
}
