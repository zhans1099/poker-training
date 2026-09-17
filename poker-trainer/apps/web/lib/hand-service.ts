import { createHash, randomBytes } from 'node:crypto'
import {
  GameRepository,
  HandNotFoundError,
  HandStateError,
  SessionNotFoundError,
} from '@poker-trainer/database'
import {
  applyPokerAction,
  chooseProfileBotAction,
  createActorView,
  deriveSeed,
  randomizeTableSeats,
  startPokerHand,
  type PokerHandState,
} from '@poker-trainer/poker-engine'
import type { SubmitHandActionInput } from '@poker-trainer/schemas'
import type { CreateHandInput } from '@poker-trainer/schemas'
import { toPublicHandEvent } from './public-hand-event'

type PrivateHand = NonNullable<Awaited<ReturnType<GameRepository['findHand']>>>

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

  async getForHero(handId: string) {
    const hand = await this.repository.findHand(handId)
    if (!hand) throw new HandNotFoundError('Hand not found')
    return publicHand(hand)
  }

  async create(sessionId: string, input: CreateHandInput) {
    const session = await this.repository.findSession(sessionId)
    if (!session) throw new SessionNotFoundError('Session not found')

    const seed = randomBytes(32).toString('hex')
    const originalPlayers = session.participants.map((participant) => ({
      seat: participant.seatNo,
      playerId: participant.playerId,
      stack: participant.stack,
    }))
    const seatedPlayers = input.randomizeSeats
      ? randomizeTableSeats(originalPlayers, seed)
      : originalPlayers
    const state = startPokerHand({
      seed,
      buttonSeat: input.buttonSeat,
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
    const hand = await this.repository.createHand(sessionId, {
      buttonSeat: input.buttonSeat,
      seedHash: createHash('sha256').update(seed).digest('hex'),
      stateHash: stateHash(state),
      state: jsonRecord(state),
      holeCardsByPlayerId,
      seatNoByPlayerId,
      initialEventPayload: {
        buttonSeat: input.buttonSeat,
        seatingMode: input.randomizeSeats ? 'RANDOM' : 'SESSION_DEFAULT',
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
      const decision = chooseProfileBotAction({
        state,
        actorId: actor.playerId,
        heroId: heroId(hand),
        profile,
        seed: deriveSeed(
          state.dealt.seed,
          `prior:${hand.version}:${actor.playerId}`,
        ),
      })
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
          source: 'PRIOR',
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
          actorView: jsonRecord(actorView),
          output: jsonRecord(decision),
          validation: { acceptedByRuleEngine: true },
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
