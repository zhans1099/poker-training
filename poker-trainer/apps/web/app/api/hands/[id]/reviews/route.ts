import { NextResponse } from 'next/server'
import { gameApiError } from '../../../../../lib/game-api-error'
import { HandReviewProviderError } from '../../../../../lib/hand-review-provider'
import { HandReviewService } from '../../../../../lib/hand-review-service'

export const runtime = 'nodejs'
const service = new HandReviewService()

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    return NextResponse.json({
      data: await service.list((await context.params).id),
    })
  } catch (error) {
    return gameApiError(error)
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const review = await service.create((await context.params).id)
    return NextResponse.json({ data: review }, { status: 201 })
  } catch (error) {
    if (error instanceof HandReviewProviderError) {
      return NextResponse.json(
        { error: { code: error.code, message: 'Hand review provider failed' } },
        { status: error.code === 'PROVIDER_NOT_CONFIGURED' ? 503 : 502 },
      )
    }
    return gameApiError(error)
  }
}
