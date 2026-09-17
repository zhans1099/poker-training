import { cardSchema, playerActionSchema } from '@poker-trainer/schemas'

interface PrivateHandEvent {
  readonly id: string
  readonly sequenceNo: number
  readonly eventType: string
  readonly actorId: string | null
  readonly payload: unknown
  readonly createdAt: Date
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : undefined
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function cards(value: unknown): string[] | undefined {
  const parsed = cardSchema.array().safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function startedPayload(payload: Record<string, unknown>) {
  const seats = Array.isArray(payload.seats)
    ? payload.seats.flatMap((value) => {
        const seat = record(value)
        const seatNo = number(seat?.seatNo)
        const playerId = string(seat?.playerId)
        return seatNo === undefined || playerId === undefined
          ? []
          : [{ seatNo, playerId }]
      })
    : []

  return {
    buttonSeat: number(payload.buttonSeat),
    seatingMode: string(payload.seatingMode),
    seats,
    smallBlind: number(payload.smallBlind),
    bigBlind: number(payload.bigBlind),
    smallBlindSeat: number(payload.smallBlindSeat),
    bigBlindSeat: number(payload.bigBlindSeat),
  }
}

function actionPayload(payload: Record<string, unknown>) {
  const action = playerActionSchema.safeParse(payload.action)
  return {
    ...(action.success ? { action: action.data } : {}),
    ...(string(payload.source) === undefined
      ? {}
      : { source: string(payload.source) }),
    streetBefore: string(payload.streetBefore),
    streetAfter: string(payload.streetAfter),
    board: cards(payload.board) ?? [],
    runoutBoards: Array.isArray(payload.runoutBoards)
      ? payload.runoutBoards.flatMap((value) => {
          const board = cards(value)
          return board === undefined ? [] : [board]
        })
      : [],
    pot: number(payload.pot),
    phase: string(payload.phase),
  }
}

export function toPublicHandEvent(event: PrivateHandEvent) {
  const payload = record(event.payload) ?? {}
  return {
    id: event.id,
    sequenceNo: event.sequenceNo,
    eventType: event.eventType,
    actorId: event.actorId,
    createdAt: event.createdAt,
    payload:
      event.eventType === 'HAND_STARTED'
        ? startedPayload(payload)
        : event.eventType === 'PLAYER_ACTION'
          ? actionPayload(payload)
          : {},
  }
}
