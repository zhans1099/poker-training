import { playerActionSchema, type HeroHandView } from '@poker-trainer/schemas'
import type { ActionEvent, CardData, SeatData } from './demo-hand'

const sixSeatSlots = ['hero', 'p', 'z', 'j', 'l', 'h'] as const
const fiveSeatSlots = ['hero', 'p', 'z', 'l', 'h'] as const

const streetLabels = {
  PREFLOP: '翻牌前',
  FLOP: '翻牌圈',
  TURN: '转牌圈',
  RIVER: '河牌圈',
  SHOWDOWN: '摊牌',
} as const

const actionLabels = {
  FOLD: '弃牌',
  CHECK: '过牌',
  CALL: '跟注',
  BET: '下注到',
  RAISE: '加注到',
  ALL_IN: 'All-in',
} as const

export function toCardData(card: string): CardData {
  const suit = {
    s: 'spade',
    h: 'heart',
    c: 'club',
    d: 'diamond',
  } as const
  const parsedSuit = suit[card.at(-1) as keyof typeof suit]
  if (parsedSuit === undefined) throw new Error(`Unsupported card: ${card}`)
  return { rank: card.slice(0, -1), suit: parsedSuit }
}

export function liveSeats(hand: HeroHandView): SeatData[] {
  const hero = hand.players.find((player) => player.kind === 'HERO')
  if (hero === undefined) return []
  const playerById = new Map(
    hand.players.map((player) => [player.playerId, player]),
  )
  const ordered = hand.view.seats.toSorted(
    (left, right) =>
      ((left.seat - hero.seatNo + hand.view.seats.length) %
        hand.view.seats.length) -
      ((right.seat - hero.seatNo + hand.view.seats.length) %
        hand.view.seats.length),
  )
  const slots = ordered.length === 5 ? fiveSeatSlots : sixSeatSlots

  return ordered.map((seat, index) => {
    const player = playerById.get(seat.playerId)
    const isHero = player?.kind === 'HERO'
    const status =
      seat.seat === hand.view.buttonSeat
        ? 'D'
        : seat.seat === hand.view.smallBlindSeat
          ? 'SB'
          : seat.seat === hand.view.bigBlindSeat
            ? 'BB'
            : undefined
    return {
      id: slots[index] ?? `seat-${index}`,
      name: player?.displayName ?? seat.playerId,
      stack: seat.stack,
      position: String(seat.seat),
      ...(status === undefined ? {} : { status }),
      ...(seat.playerId === hand.view.currentActorPlayerId
        ? { active: true }
        : {}),
      ...(isHero ? { hero: true } : {}),
      ...(seat.status === 'FOLDED' ? { folded: true } : {}),
    }
  })
}

export function liveActions(hand: HeroHandView): ActionEvent[] {
  const playerById = new Map(
    hand.players.map((player) => [player.playerId, player.displayName]),
  )
  return hand.events.flatMap((event) => {
    if (event.eventType !== 'PLAYER_ACTION') return []
    const parsedAction = playerActionSchema.safeParse(event.payload.action)
    if (!parsedAction.success) return []
    const action = parsedAction.data
    const street = event.payload.streetBefore
    if (typeof street !== 'string' || !(street in streetLabels)) return []
    const amount = 'to' in action ? action.to : undefined
    return [
      {
        id: event.id,
        actor:
          (event.actorId === null
            ? undefined
            : playerById.get(event.actorId)) ?? '系统',
        action: actionLabels[action.type],
        ...(amount === undefined ? {} : { amount }),
        street: streetLabels[street as keyof typeof streetLabels],
        tone:
          action.type === 'FOLD'
            ? 'muted'
            : action.type === 'CALL'
              ? 'call'
              : action.type === 'CHECK'
                ? 'muted'
                : 'raise',
      },
    ]
  })
}
