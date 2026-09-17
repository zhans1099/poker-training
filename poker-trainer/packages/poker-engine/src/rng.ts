import { PokerRuleError } from './errors'

const UINT32_RANGE = 0x1_0000_0000

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

function xmur3(seed: string): () => number {
  let hash = 1779033703 ^ seed.length
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353)
    hash = rotateLeft(hash, 13)
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
    hash ^= hash >>> 16
    return hash >>> 0
  }
}

export class SeededRng {
  private state: [number, number, number, number]

  constructor(seed: string) {
    const seedFactory = xmur3(seed)
    this.state = [seedFactory(), seedFactory(), seedFactory(), seedFactory()]
    if (this.state.every((value) => value === 0)) {
      this.state[0] = 1
    }
  }

  nextUint32(): number {
    const [state0, state1, state2, state3] = this.state
    const result = Math.imul(rotateLeft(Math.imul(state1, 5) >>> 0, 7), 9) >>> 0
    const temporary = (state1 << 9) >>> 0

    let nextState2 = (state2 ^ state0) >>> 0
    let nextState3 = (state3 ^ state1) >>> 0
    const nextState1 = (state1 ^ nextState2) >>> 0
    const nextState0 = (state0 ^ nextState3) >>> 0
    nextState2 = (nextState2 ^ temporary) >>> 0
    nextState3 = rotateLeft(nextState3, 11)
    this.state = [nextState0, nextState1, nextState2, nextState3]

    return result
  }

  nextFloat(): number {
    return this.nextUint32() / UINT32_RANGE
  }

  nextInt(maxExclusive: number): number {
    if (
      !Number.isSafeInteger(maxExclusive) ||
      maxExclusive <= 0 ||
      maxExclusive > UINT32_RANGE
    ) {
      throw new PokerRuleError(
        'INVALID_CHIPS',
        `Random integer bound must be between 1 and ${UINT32_RANGE}`,
      )
    }

    const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive
    let value = this.nextUint32()
    while (value >= limit) {
      value = this.nextUint32()
    }
    return value % maxExclusive
  }
}

export function deriveSeed(parentSeed: string, namespace: string): string {
  return `${parentSeed}::${namespace}`
}

export function shuffleWithSeed<T>(values: readonly T[], seed: string): T[] {
  const shuffled = [...values]
  const rng = new SeededRng(seed)
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.nextInt(index + 1)
    const current = shuffled[index]
    const target = shuffled[swapIndex]
    if (current === undefined || target === undefined) {
      throw new PokerRuleError(
        'INVARIANT_VIOLATION',
        'Shuffle index escaped array bounds',
      )
    }
    shuffled[index] = target
    shuffled[swapIndex] = current
  }
  return shuffled
}
