import type { Card, Rank } from '@poker-trainer/domain'
import { assertUniqueCards } from './cards'
import { PokerRuleError } from './errors'

export type HandCategory =
  | 'HIGH_CARD'
  | 'ONE_PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_FLUSH'

export interface EvaluatedHand {
  readonly category: HandCategory
  readonly categoryRank: number
  readonly tiebreak: readonly number[]
  readonly cards: readonly Card[]
}

const rankValues: Readonly<Record<Rank, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

function rankOf(card: Card): number {
  return rankValues[card[0] as Rank]
}

function compareNumberArrays(
  left: readonly number[],
  right: readonly number[],
): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

function straightHigh(ranks: readonly number[]): number | null {
  const unique = [...new Set(ranks)].toSorted((left, right) => right - left)
  if (unique.includes(14)) unique.push(1)
  for (let index = 0; index <= unique.length - 5; index += 1) {
    const window = unique.slice(index, index + 5)
    if (window.every((rank, offset) => rank === window[0]! - offset)) {
      return window[0]!
    }
  }
  return null
}

function evaluateFive(cards: readonly Card[]): EvaluatedHand {
  if (cards.length !== 5) {
    throw new PokerRuleError('INVALID_CARD', 'Exactly five cards are required')
  }
  const ranks = cards.map(rankOf).toSorted((left, right) => right - left)
  const flush = cards.every((card) => card[1] === cards[0]![1])
  const highStraight = straightHigh(ranks)
  const counts = new Map<number, number>()
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1)
  const groups = [...counts.entries()].toSorted(
    ([leftRank, leftCount], [rightRank, rightCount]) =>
      rightCount - leftCount || rightRank - leftRank,
  )

  if (flush && highStraight !== null) {
    return {
      category: 'STRAIGHT_FLUSH',
      categoryRank: 8,
      tiebreak: [highStraight],
      cards,
    }
  }
  if (groups[0]?.[1] === 4) {
    return {
      category: 'FOUR_OF_A_KIND',
      categoryRank: 7,
      tiebreak: [groups[0][0], groups[1]![0]],
      cards,
    }
  }
  if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    return {
      category: 'FULL_HOUSE',
      categoryRank: 6,
      tiebreak: [groups[0][0], groups[1][0]],
      cards,
    }
  }
  if (flush) {
    return {
      category: 'FLUSH',
      categoryRank: 5,
      tiebreak: ranks,
      cards,
    }
  }
  if (highStraight !== null) {
    return {
      category: 'STRAIGHT',
      categoryRank: 4,
      tiebreak: [highStraight],
      cards,
    }
  }
  if (groups[0]?.[1] === 3) {
    return {
      category: 'THREE_OF_A_KIND',
      categoryRank: 3,
      tiebreak: [groups[0][0], ...groups.slice(1).map(([rank]) => rank)],
      cards,
    }
  }
  if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    const pairRanks = [groups[0][0], groups[1][0]].toSorted(
      (left, right) => right - left,
    )
    return {
      category: 'TWO_PAIR',
      categoryRank: 2,
      tiebreak: [...pairRanks, groups[2]![0]],
      cards,
    }
  }
  if (groups[0]?.[1] === 2) {
    return {
      category: 'ONE_PAIR',
      categoryRank: 1,
      tiebreak: [groups[0][0], ...groups.slice(1).map(([rank]) => rank)],
      cards,
    }
  }
  return {
    category: 'HIGH_CARD',
    categoryRank: 0,
    tiebreak: ranks,
    cards,
  }
}

function fiveCardCombinations(cards: readonly Card[]): Card[][] {
  const combinations: Card[][] = []
  for (let first = 0; first < cards.length - 4; first += 1) {
    for (let second = first + 1; second < cards.length - 3; second += 1) {
      for (let third = second + 1; third < cards.length - 2; third += 1) {
        for (let fourth = third + 1; fourth < cards.length - 1; fourth += 1) {
          for (let fifth = fourth + 1; fifth < cards.length; fifth += 1) {
            combinations.push([
              cards[first]!,
              cards[second]!,
              cards[third]!,
              cards[fourth]!,
              cards[fifth]!,
            ])
          }
        }
      }
    }
  }
  return combinations
}

export function compareEvaluatedHands(
  left: EvaluatedHand,
  right: EvaluatedHand,
): number {
  return (
    Math.sign(left.categoryRank - right.categoryRank) ||
    compareNumberArrays(left.tiebreak, right.tiebreak)
  )
}

export function evaluateBestHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new PokerRuleError(
      'INVALID_CARD',
      'Best-hand evaluation requires five to seven cards',
    )
  }
  assertUniqueCards(cards)
  const combinations = fiveCardCombinations(cards)
  let best = evaluateFive(combinations[0]!)
  for (const combination of combinations.slice(1)) {
    const candidate = evaluateFive(combination)
    if (compareEvaluatedHands(candidate, best) > 0) best = candidate
  }
  return best
}
