export type PokerRuleErrorCode =
  | 'INVALID_CHIPS'
  | 'INVALID_TABLE'
  | 'INVALID_CARD'
  | 'DUPLICATE_CARD'
  | 'ROUND_COMPLETE'
  | 'OUT_OF_TURN'
  | 'ILLEGAL_ACTION'
  | 'INVALID_AMOUNT'
  | 'INVARIANT_VIOLATION'

export class PokerRuleError extends Error {
  readonly code: PokerRuleErrorCode

  constructor(code: PokerRuleErrorCode, message: string) {
    super(message)
    this.name = 'PokerRuleError'
    this.code = code
  }
}
