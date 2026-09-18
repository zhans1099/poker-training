import {
  GameRepository,
  HandNotFoundError,
  HandStateError,
  ProfileRepository,
} from '@poker-trainer/database'
import { reviewCompletedHand } from './hand-review-provider'
import { toPublicHandEvent } from './public-hand-event'

function jsonRecord(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

export class HandReviewService {
  constructor(
    private readonly repository = new GameRepository(),
    private readonly profileRepository = new ProfileRepository(),
  ) {}

  async list(handId: string) {
    const hand = await this.repository.findHandForReview(handId)
    if (!hand) throw new HandNotFoundError('Hand not found')
    return hand.reviews
  }

  async create(handId: string) {
    const hand = await this.repository.findHandForReview(handId)
    if (!hand) throw new HandNotFoundError('Hand not found')
    if (hand.status !== 'COMPLETED') {
      throw new HandStateError('Only a completed hand can be reviewed')
    }
    const hero = hand.participants.find(
      (participant) => participant.player.kind === 'HERO',
    )
    if (!hero) throw new HandStateError('Hand does not contain a Hero')
    const state = jsonRecord(hand.state)
    const heroPosition =
      hero.seatNo === hand.buttonSeat
        ? ('BUTTON' as const)
        : hero.seatNo === state.smallBlindSeat
          ? ('SMALL_BLIND' as const)
          : hero.seatNo === state.bigBlindSeat
            ? ('BIG_BLIND' as const)
            : ('OTHER' as const)

    const audited = await reviewCompletedHand({
      handId: hand.id,
      heroId: hero.playerId,
      heroSeatNo: hero.seatNo,
      heroPosition,
      status: 'COMPLETED',
      players: hand.participants.map((participant) => ({
        playerId: participant.playerId,
        displayName: participant.player.displayName,
        kind: participant.player.kind,
      })),
      publicEvents: hand.events.map(toPublicHandEvent),
      heroDecisions: hand.decisions.map((decision) => ({
        eventSequence: decision.eventSequence,
        actorView: jsonRecord(decision.actorView),
        ...(decision.thoughtInput === null
          ? {}
          : { thoughtInput: jsonRecord(decision.thoughtInput) }),
        legalActions: jsonRecord(decision.legalActions),
        chosenAction: jsonRecord(decision.chosenAction),
      })),
      ...(hand.result === null ? {} : { result: jsonRecord(hand.result) }),
    })

    const review = await this.repository.createHandReview(handId, {
      provider: audited.provider,
      model: audited.model,
      promptVersion: audited.promptVersion,
      review: {
        ...audited.review,
        audit: {
          latencyMs: audited.latencyMs,
          inputTokens: audited.inputTokens,
          outputTokens: audited.outputTokens,
        },
      },
    })
    await this.profileRepository.createReviewFeedbacks(
      handId,
      `deepseek-review:${review.id}`,
      audited.review.profileObservations,
    )
    return review
  }
}
