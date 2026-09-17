export const RANKS = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'T',
  'J',
  'Q',
  'K',
  'A',
] as const

export const SUITS = ['c', 'd', 'h', 's'] as const

export type Rank = (typeof RANKS)[number]
export type Suit = (typeof SUITS)[number]
export type Card = `${Rank}${Suit}`
export type Chips = number
export type PlayerId = string
export type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN'

export type PlayerAction =
  | { readonly type: 'FOLD' }
  | { readonly type: 'CHECK' }
  | { readonly type: 'CALL'; readonly to: Chips }
  | { readonly type: 'BET'; readonly to: Chips }
  | { readonly type: 'RAISE'; readonly to: Chips }
  | { readonly type: 'ALL_IN'; readonly to: Chips }

export interface LegalActionSet {
  readonly canFold: boolean
  readonly canCheck: boolean
  readonly callAmount: Chips
  readonly callTo: Chips | null
  readonly canCall: boolean
  readonly canBet: boolean
  readonly canRaise: boolean
  readonly canAllIn: boolean
  readonly minBetTo: Chips | null
  readonly minRaiseTo: Chips | null
  readonly maxTo: Chips
  readonly raiseRightsOpen: boolean
}

export type PlayerStatus = 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'SITTING_OUT'
