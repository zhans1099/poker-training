import {
  DatabaseConfigurationError,
  HandNotFoundError,
  HandStateError,
  HandVersionConflictError,
  ParticipantValidationError,
  SessionNotFoundError,
  SessionStateError,
} from '@poker-trainer/database'
import { PokerRuleError } from '@poker-trainer/poker-engine'
import { NextResponse } from 'next/server'

export function gameApiError(error: unknown) {
  if (error instanceof DatabaseConfigurationError) {
    return NextResponse.json(
      { error: { code: 'DATABASE_NOT_CONFIGURED', message: error.message } },
      { status: 503 },
    )
  }
  if (
    error instanceof SessionNotFoundError ||
    error instanceof HandNotFoundError
  ) {
    return NextResponse.json(
      { error: { code: error.name, message: error.message } },
      { status: 404 },
    )
  }
  if (
    error instanceof SessionStateError ||
    error instanceof HandStateError ||
    error instanceof HandVersionConflictError
  ) {
    return NextResponse.json(
      { error: { code: error.name, message: error.message } },
      { status: 409 },
    )
  }
  if (error instanceof ParticipantValidationError) {
    return NextResponse.json(
      { error: { code: error.name, message: error.message } },
      { status: 400 },
    )
  }
  if (error instanceof PokerRuleError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 422 },
    )
  }
  console.error('Game API failed', error)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    { status: 500 },
  )
}
