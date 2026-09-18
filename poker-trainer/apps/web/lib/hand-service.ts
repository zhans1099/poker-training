import { createHash, randomBytes } from 'node:crypto'
import {
  GameRepository,
  HandNotFoundError,
  HandStateError,
  SessionNotFoundError,
  SessionStateError,
} from '@poker-trainer/database'
import {
  applyPokerAction,
  createActorView,
  deriveSeed,
  randomizeTableSeats,
  startPokerHand,
  type PokerHandState,
} from '@poker-trainer/poker-engine'
import type {
  CreateHandInput,
  CreateNextHandInput,
  SubmitHandActionInput,
} from '@poker-trainer/schemas'
import { nextButtonPlayerId } from './next-hand'
import { chooseAuditedPlayerAction } from './player-decision-provider'
import { toPublicHandEvent } from './public-hand-event'

type PrivateHand = NonNullable<Awaited<ReturnType<GameRepository['findHand']>>>
type PrivateSession = NonNullable<
  Awaited<ReturnType<GameRepository['findSession']>>
>

interface StartingPlayer {
  seat: number
  playerId: string
  stack: number
}

function jsonRecord(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function stateHash(state: PokerHandState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex')
}

function readState(hand: PrivateHand): PokerHandState {
  const state = hand.state as unknown as PokerHandState
  if (state.schemaVersion !== 1) {
    throw new HandStateError('Unsupported or missing hand state')
  }
  return state
}

function heroId(hand: PrivateHand): string {
  const hero = hand.participants.find(
    (participant) => participant.player.kind === 'HERO',
  )
  if (hero === undefined) {
    throw new HandStateError('Hand does not contain a Hero participant')
  }
  return hero.playerId
}

function publicHand(hand: PrivateHand) {
  const state = readState(hand)
  const viewerId = heroId(hand)
  return {
    id: hand.id,
    sessionId: hand.sessionId,
    handNo: hand.handNo,
    status: hand.status,
    version: hand.version,
    stateHash: hand.stateHash,
    startedAt: hand.startedAt,
    completedAt: hand.completedAt,
    players: hand.participants.map((participant) => ({
      playerId: participant.playerId,
      displayName: participant.player.displayName,
      kind: participant.player.kind,
      seatNo: participant.seatNo,
      profileVersion: participant.profileVersion.version,
    })),
    events: hand.events.map(toPublicHandEvent),
    view: createActorView(state, viewerId),
  }
}

export class HandService {
  constructor(private readonly repository = new GameRepository()) {}

  private async findSuccessorAfterConflict(
    sessionId: string,
    handNo: number,
  ): Promise<PrivateHand | null> {
    const retryDelays = [0, 25, 50, 100, 200]
    for (const delayMs of retryDelays) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
      const successor = await this.repository.findHandByNumber(
        sessionId,
        handNo,
      )
      if (successor) return successor
    }
    return null
  }

  async getForHero(handId: string) {
    const hand = await this.repository.findHand(handId)
    if (!hand) throw new HandNotFoundError('Hand not found')
    return publicHand(hand)
  }

  async create(sessionId: string, input: CreateHandInput) {
    const session = await this.repository.findSession(sessionId)
    if (!session) throw new SessionNotFoundError('Session not found')
    const originalPlayers = session.participants.map((participant) => ({
      seat: participant.seatNo,
      playerId: participant.playerId,
      stack: participant.stack,
    }))

    return this.createForPlayers(session, originalPlayers, input)
  }

  async createNext(previousHandId: string, input: CreateNextHandInput) {
    const previousHand = await this.repository.findHand(previousHandId)
    if (!previousHand) throw new HandNotFoundError('Hand not found')
    if (previousHand.status !== 'COMPLETED') {
      throw new HandStateError(
        'The current hand must be completed before starting the next hand',
      )
    }
    const existingSuccessor = await this.repository.findHandByNumber(
      previousHand.sessionId,
      previousHand.handNo + 1,
    )
    if (existingSuccessor) return publicHand(existingSuccessor)
    const session = await this.repository.findSession(previousHand.sessionId)
    if (!session) throw new SessionNotFoundError('Session not found')

    const settledPlayers = previousHand.participants.map((participant) => {
      if (participant.endingStack === null) {
        throw new HandStateError('Completed hand is missing ending stacks')
      }
      return {
        seat: participant.seatNo,
        playerId: participant.playerId,
        stack: participant.endingStack,
      }
    })
    let buttonPlayerId: string
    try {
      buttonPlayerId = nextButtonPlayerId(
        previousHand.buttonSeat,
        settledPlayers,
      )
    } catch (error) {
      throw new HandStateError(
        error instanceof Error ? error.message : 'Unable to rotate the button',
      )
    }

    try {
      return await this.createForPlayers(
        session,
        settledPlayers,
        input,
        buttonPlayerId,
      )
    } catch (error) {
      if (
        error instanceof SessionStateError ||
        (error instanceof Error && error.name === 'SessionStateError')
      ) {
        const successor = await this.findSuccessorAfterConflict(
          previousHand.sessionId,
          previousHand.handNo + 1,
        )
        if (successor) return publicHand(successor)
      }
      throw error
    }
  }

  private async createForPlayers(
    session: PrivateSession,
    originalPlayers: readonly StartingPlayer[],
    input: CreateHandInput | CreateNextHandInput,
    rotatingButtonPlayerId?: string,
  ) {
    const seed = randomBytes(32).toString('hex')
    const seatedPlayers = input.randomizeSeats
      ? randomizeTableSeats(originalPlayers, seed)
      : originalPlayers
    const buttonSeat =
      rotatingButtonPlayerId === undefined
        ? (input as CreateHandInput).buttonSeat
        : seatedPlayers.find(
            (player) => player.playerId === rotatingButtonPlayerId,
          )?.seat
    if (buttonSeat === undefined) {
      throw new HandStateError('Unable to determine the button seat')
    }
    const state = startPokerHand({
      seed,
      buttonSeat,
      smallBlind: session.smallBlind,
      bigBlind: session.bigBlind,
      players: seatedPlayers,
    })
    const holeCardsByPlayerId = Object.fromEntries(
      state.dealt.seats.map((seat) => [seat.playerId, seat.holeCards]),
    )
    const seatNoByPlayerId = Object.fromEntries(
      state.dealt.seats.map((seat) => [seat.playerId, seat.seat]),
    )
    const hand = await this.repository.createHand(session.id, {
      buttonSeat,
      seedHash: createHash('sha256').update(seed).digest('hex'),
      stateHash: stateHash(state),
      state: jsonRecord(state),
      holeCardsByPlayerId,
      seatNoByPlayerId,
      initialEventPayload: {
        buttonSeat,
        seatingMode: input.randomizeSeats
          ? 'RANDOM'
          : rotatingButtonPlayerId === undefined
            ? 'SESSION_DEFAULT'
            : 'PREVIOUS_HAND',
        seats: state.dealt.seats.map((seat) => ({
          seatNo: seat.seat,
          playerId: seat.playerId,
        })),
        smallBlind: session.smallBlind,
        bigBlind: session.bigBlind,
        smallBlindSeat: state.dealt.smallBlindSeat,
        bigBlindSeat: state.dealt.bigBlindSeat,
      },
    })
    await this.advanceBots(hand.id)
    return this.getForHero(hand.id)
  }

  private async advanceBots(handId: string): Promise<void> {
    const configuredBudget = Number(
      process.env.AI_PLAYER_MAX_LLM_DECISIONS_PER_TURN,
    )
    let remainingLlmDecisions =
      Number.isSafeInteger(configuredBudget) && configuredBudget >= 0
        ? configuredBudget
        : 2
    for (let step = 0; step < 200; step += 1) {
      const hand = await this.repository.findHand(handId)
      if (!hand) throw new HandNotFoundError('Hand not found')
      if (hand.status !== 'ACTIVE') return
      const state = readState(hand)
      const actor = state.betting.players.find(
        (player) => player.seat === state.betting.currentActorSeat,
      )
      if (actor === undefined) return
      const participant = hand.participants.find(
        (candidate) => candidate.playerId === actor.playerId,
      )
      if (participant === undefined) {
        throw new HandStateError('Current actor is not a hand participant')
      }
      if (participant.player.kind === 'HERO') return

      const actorView = createActorView(state, actor.playerId)
      if (actorView.legalActions === null) {
        throw new HandStateError('Bot actor has no legal action set')
      }
      const rawProfile = participant.profileVersion.profile
      const profile =
        typeof rawProfile === 'object' &&
        rawProfile !== null &&
        !Array.isArray(rawProfile)
          ? (rawProfile as Record<string, unknown>)
          : {}
      const decision = await chooseAuditedPlayerAction(
        {
          state,
          actorId: actor.playerId,
          heroId: heroId(hand),
          profile,
          seed: deriveSeed(
            state.dealt.seed,
            `prior:${hand.version}:${actor.playerId}`,
          ),
          actorView,
          players: hand.participants.map((entry) => ({
            playerId: entry.playerId,
            displayName: entry.player.displayName,
            kind: entry.player.kind,
          })),
          publicEvents: hand.events.map((event) =>
            jsonRecord(toPublicHandEvent(event)),
          ),
        },
        { allowLlm: remainingLlmDecisions > 0 },
      )
      if (decision.source !== 'PRIOR') remainingLlmDecisions -= 1
      const nextState = applyPokerAction(state, actor.playerId, decision.action)
      const handStatus =
        nextState.phase === 'COMPLETE'
          ? 'COMPLETED'
          : nextState.phase === 'SHOWDOWN'
            ? 'FROZEN'
            : 'ACTIVE'
      const endingStacks =
        nextState.phase === 'COMPLETE'
          ? Object.fromEntries(
              nextState.dealt.seats.map((seat) => [seat.playerId, seat.stack]),
            )
          : undefined
      await this.repository.appendEvent(handId, {
        expectedVersion: hand.version,
        commandId: `bot_${hand.version}_${participant.seatNo}`,
        eventType: 'PLAYER_ACTION',
        actorId: actor.playerId,
        payload: {
          action: decision.action,
          source: decision.source,
          reason: decision.reason,
          streetBefore: state.dealt.street,
          streetAfter: nextState.dealt.street,
          board: nextState.dealt.board,
          runoutBoards: nextState.runoutBoards,
          pot: nextState.pot,
          phase: nextState.phase,
        },
        stateHash: stateHash(nextState),
        nextState: jsonRecord(nextState),
        handStatus,
        ...(nextState.result === null
          ? {}
          : { result: jsonRecord(nextState.result) }),
        ...(endingStacks === undefined ? {} : { endingStacks }),
        aiDecision: {
          playerId: actor.playerId,
          profileVersionId: participant.profileVersionId,
          provider: decision.provider,
          model: decision.model,
          source: decision.source,
          promptVersion: decision.promptVersion,
          actorView: jsonRecord(actorView),
          output: jsonRecord(decision),
          validation: decision.validation,
          ...(decision.latencyMs === undefined
            ? {}
            : { latencyMs: decision.latencyMs }),
          ...(decision.inputTokens === undefined
            ? {}
            : { inputTokens: decision.inputTokens }),
          ...(decision.outputTokens === undefined
            ? {}
            : { outputTokens: decision.outputTokens }),
        },
      })
    }
    throw new HandStateError('Bot action loop exceeded its safety limit')
  }

  async submitHeroAction(handId: string, input: SubmitHandActionInput) {
    const receipt = await this.repository.findEventByCommand(
      handId,
      input.commandId,
    )
    if (receipt) {
      return {
        event: receipt,
        idempotentReplay: true,
        hand: await this.getForHero(handId),
      }
    }

    const hand = await this.repository.findHand(handId)
    if (!hand) throw new HandNotFoundError('Hand not found')
    if (hand.status !== 'ACTIVE') {
      throw new HandStateError('Hand is not accepting player actions')
    }

    const state = readState(hand)
    const actorId = heroId(hand)
    const actorView = createActorView(state, actorId)
    const legalActions = actorView.legalActions
    if (legalActions === null) {
      throw new HandStateError('It is not Hero’s turn')
    }
    const nextState = applyPokerAction(state, actorId, input.action)
    const handStatus =
      nextState.phase === 'COMPLETE'
        ? 'COMPLETED'
        : nextState.phase === 'SHOWDOWN'
          ? 'FROZEN'
          : 'ACTIVE'
    const endingStacks =
      nextState.phase === 'COMPLETE'
        ? Object.fromEntries(
            nextState.dealt.seats.map((seat) => [seat.playerId, seat.stack]),
          )
        : undefined
    const result = await this.repository.appendEvent(handId, {
      expectedVersion: input.expectedVersion,
      commandId: input.commandId,
      eventType: 'PLAYER_ACTION',
      actorId,
      payload: {
        action: input.action,
        streetBefore: state.dealt.street,
        streetAfter: nextState.dealt.street,
        board: nextState.dealt.board,
        runoutBoards: nextState.runoutBoards,
        pot: nextState.pot,
        phase: nextState.phase,
      },
      stateHash: stateHash(nextState),
      nextState: jsonRecord(nextState),
      handStatus,
      ...(nextState.result === null
        ? {}
        : { result: jsonRecord(nextState.result) }),
      ...(endingStacks === undefined ? {} : { endingStacks }),
      heroDecision: {
        heroId: actorId,
        actorView: jsonRecord(actorView),
        ...(input.thoughtInput === undefined
          ? {}
          : { thoughtInput: input.thoughtInput }),
        legalActions: jsonRecord(legalActions),
        chosenAction: jsonRecord(input.action),
      },
    })

    await this.advanceBots(handId)

    return {
      event: result.event,
      idempotentReplay: result.idempotentReplay,
      hand: await this.getForHero(handId),
    }
  }
}
