import { nextSeat } from '@poker-trainer/poker-engine'

export interface SettledSeat {
  seat: number
  playerId: string
  stack: number
}

export function nextButtonPlayerId(
  previousButtonSeat: number,
  seats: readonly SettledSeat[],
): string {
  const activeSeats = seats
    .filter((seat) => seat.stack > 0)
    .map((seat) => seat.seat)
  if (activeSeats.length < 2) {
    throw new Error('至少需要两名仍有筹码的玩家才能开始下一手')
  }
  const buttonSeat = nextSeat(activeSeats, previousButtonSeat)
  const buttonPlayer = seats.find((seat) => seat.seat === buttonSeat)
  if (buttonPlayer === undefined) {
    throw new Error('无法确定下一手庄家')
  }
  return buttonPlayer.playerId
}
