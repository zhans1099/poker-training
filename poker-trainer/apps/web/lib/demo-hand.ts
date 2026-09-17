export type Suit = 'spade' | 'heart' | 'club' | 'diamond'

export interface CardData {
  rank: string
  suit: Suit
}

export interface SeatData {
  id: string
  name: string
  stack: number
  position: string
  status?: string
  active?: boolean
  hero?: boolean
  folded?: boolean
}

export interface ActionEvent {
  id: string
  actor: string
  action: string
  amount?: number
  street: '翻牌前' | '翻牌圈' | '转牌圈' | '河牌圈' | '摊牌'
  tone?: 'muted' | 'raise' | 'call'
}

export const demoSeats: SeatData[] = [
  { id: 'z', name: 'JL', stack: 1980, position: 'CO', folded: true },
  { id: 'j', name: 'JJ', stack: 2340, position: 'BTN', status: 'D' },
  { id: 'l', name: '23', stack: 1760, position: 'SB', folded: true },
  {
    id: 'h',
    name: 'HG',
    stack: 3420,
    position: 'BB',
    status: 'BB',
    active: true,
  },
  { id: 'hero', name: 'Hero', stack: 2680, position: 'UTG', hero: true },
  {
    id: 'p',
    name: '胖子',
    stack: 2150,
    position: 'HJ',
    status: 'SB',
    folded: true,
  },
]

export function randomizeOpponentSeats(seats: readonly SeatData[]): SeatData[] {
  const opponentIndexes = seats.flatMap((seat, index) =>
    seat.hero ? [] : [index],
  )
  const opponents = opponentIndexes.map((index) => seats[index]!)

  for (let index = opponents.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[opponents[index], opponents[swapIndex]] = [
      opponents[swapIndex]!,
      opponents[index]!,
    ]
  }

  if (
    opponents.length > 1 &&
    opponents.every(
      (opponent, index) => opponent.id === seats[opponentIndexes[index]!]!.id,
    )
  ) {
    opponents.push(opponents.shift()!)
  }

  const nextSeats = seats.map((seat) => ({ ...seat }))
  opponentIndexes.forEach((targetIndex, opponentIndex) => {
    const target = seats[targetIndex]!
    const opponent = opponents[opponentIndex]!
    const opponentWithoutStatus = { ...opponent }
    delete opponentWithoutStatus.status
    nextSeats[targetIndex] = {
      ...opponentWithoutStatus,
      id: target.id,
      position: target.position,
      ...(target.status === undefined ? {} : { status: target.status }),
    }
  })

  return nextSeats
}

export const heroCards: CardData[] = [
  { rank: 'K', suit: 'heart' },
  { rank: 'Q', suit: 'heart' },
]

export const boardCards: CardData[] = [
  { rank: 'A', suit: 'spade' },
  { rank: '7', suit: 'heart' },
  { rank: '4', suit: 'club' },
]

export const initialActions: ActionEvent[] = [
  {
    id: 'a1',
    actor: 'Hero',
    action: '加注到',
    amount: 120,
    street: '翻牌前',
    tone: 'raise',
  },
  {
    id: 'a2',
    actor: 'HG',
    action: '跟注',
    amount: 120,
    street: '翻牌前',
    tone: 'call',
  },
  { id: 'a3', actor: 'HG', action: '过牌', street: '翻牌圈', tone: 'muted' },
  {
    id: 'a4',
    actor: 'Hero',
    action: '下注',
    amount: 180,
    street: '翻牌圈',
    tone: 'raise',
  },
  {
    id: 'a5',
    actor: 'HG',
    action: '加注到',
    amount: 320,
    street: '翻牌圈',
    tone: 'raise',
  },
]
