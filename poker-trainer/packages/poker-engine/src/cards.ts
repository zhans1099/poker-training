import {
  RANKS,
  SUITS,
  type Card,
  type Rank,
  type Suit,
} from '@poker-trainer/domain'
import { PokerRuleError } from './errors'

const rankSet = new Set<string>(RANKS)
const suitSet = new Set<string>(SUITS)

export function isCard(value: string): value is Card {
  return (
    value.length === 2 &&
    rankSet.has(value[0] ?? '') &&
    suitSet.has(value[1] ?? '')
  )
}

export function parseCard(value: string): Card {
  if (!isCard(value)) {
    throw new PokerRuleError('INVALID_CARD', `Invalid card: ${value}`)
  }
  return value
}

export function createCard(rank: Rank, suit: Suit): Card {
  return `${rank}${suit}`
}

export function createStandardDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(rank, suit))
    }
  }
  return deck
}

export function assertUniqueCards(cards: readonly Card[]): void {
  if (new Set(cards).size !== cards.length) {
    throw new PokerRuleError('DUPLICATE_CARD', 'Cards must be globally unique')
  }
}
