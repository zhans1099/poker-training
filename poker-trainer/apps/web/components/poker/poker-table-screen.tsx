'use client'

import type { LegalActionSet } from '@poker-trainer/domain'
import type {
  HeroHandView,
  HeroThoughtInput,
  PlayerActionInput,
} from '@poker-trainer/schemas'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  boardCards as demoBoardCards,
  demoSeats,
  heroCards as demoHeroCards,
  initialActions,
  randomizeOpponentSeats,
  type ActionEvent,
} from '../../lib/demo-hand'
import { fetchHeroHand, submitHeroAction } from '../../lib/game-client'
import { liveActions, liveSeats, toCardData } from '../../lib/live-hand-view'
import { ActionTimeline } from './action-timeline'
import { DecisionPanel } from './decision-panel'
import { HistoryIcon, SettingsIcon, UserIcon } from './icons'
import { TableCanvas } from './table-canvas'

const demoLegalActions: LegalActionSet = {
  canFold: true,
  canCheck: false,
  callAmount: 180,
  callTo: 320,
  canCall: true,
  canBet: false,
  canRaise: true,
  canAllIn: true,
  minBetTo: null,
  minRaiseTo: 640,
  maxTo: 2680,
  raiseRightsOpen: true,
}

const unavailableActions: LegalActionSet = {
  canFold: false,
  canCheck: false,
  callAmount: 0,
  callTo: null,
  canCall: false,
  canBet: false,
  canRaise: false,
  canAllIn: false,
  minBetTo: null,
  minRaiseTo: null,
  maxTo: 0,
  raiseRightsOpen: false,
}

const streetLabels = {
  PREFLOP: '翻牌前',
  FLOP: '翻牌圈',
  TURN: '转牌圈',
  RIVER: '河牌圈',
  SHOWDOWN: '摊牌',
} as const

function suggestedBetTo(actions: LegalActionSet): number {
  return actions.minBetTo ?? actions.minRaiseTo ?? actions.maxTo
}

function actionPresentation(action: PlayerActionInput) {
  const labels = {
    FOLD: '弃牌',
    CHECK: '过牌',
    CALL: '跟注',
    BET: '下注到',
    RAISE: '加注到',
    ALL_IN: 'All-in',
  } as const
  return {
    label: labels[action.type],
    amount: 'to' in action ? action.to : undefined,
    tone:
      action.type === 'FOLD' || action.type === 'CHECK'
        ? ('muted' as const)
        : action.type === 'CALL'
          ? ('call' as const)
          : ('raise' as const),
  }
}

export function PokerTableScreen({ handId }: { handId?: string }) {
  const [demoActions, setDemoActions] = useState<ActionEvent[]>(initialActions)
  const [demoSeatState, setDemoSeatState] = useState(() => demoSeats)
  const [liveHand, setLiveHand] = useState<HeroHandView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(handId !== undefined)
  const [submitting, setSubmitting] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [betTo, setBetTo] = useState(760)
  const [selectedAction, setSelectedAction] = useState<
    PlayerActionInput['type'] | null
  >(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (handId === undefined) return
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    fetchHeroHand(handId, controller.signal)
      .then((hand) => {
        setLiveHand(hand)
        if (hand.view.legalActions !== null) {
          setBetTo(suggestedBetTo(hand.view.legalActions))
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : '真实手牌加载失败',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [handId])

  const seats = useMemo(
    () => (liveHand === null ? demoSeatState : liveSeats(liveHand)),
    [demoSeatState, liveHand],
  )
  const actions = useMemo(
    () => (liveHand === null ? demoActions : liveActions(liveHand)),
    [demoActions, liveHand],
  )
  const heroCards = useMemo(() => {
    if (liveHand === null) return demoHeroCards
    const cards = liveHand.view.seats.find(
      (seat) => seat.holeCards !== null,
    )?.holeCards
    return cards?.map(toCardData) ?? []
  }, [liveHand])
  const boardCards = useMemo(
    () =>
      liveHand === null ? demoBoardCards : liveHand.view.board.map(toCardData),
    [liveHand],
  )
  const legalActions =
    liveHand?.view.legalActions ??
    (handId === undefined ? demoLegalActions : unavailableActions)
  const pot = liveHand?.view.pot ?? 860
  const currentBet = liveHand?.view.currentBet ?? 320
  const streetLabel =
    liveHand === null ? '翻牌圈' : streetLabels[liveHand.view.street]

  async function recordAction(
    action: PlayerActionInput,
    thoughtInput: HeroThoughtInput,
  ) {
    setSelectedAction(action.type)
    const presentation = actionPresentation(action)
    const label =
      presentation.amount === undefined
        ? presentation.label
        : `${presentation.label} ${presentation.amount.toLocaleString('en-US')}`

    if (handId !== undefined) {
      if (liveHand === null) return
      setSubmitting(true)
      setLoadError(null)
      try {
        const nextHand = await submitHeroAction(handId, {
          expectedVersion: liveHand.version,
          commandId: crypto.randomUUID().replaceAll('-', ''),
          action,
          thoughtInput,
        })
        setLiveHand(nextHand)
        setNotice(`已提交：${label}`)
        if (nextHand.view.legalActions !== null) {
          setBetTo(suggestedBetTo(nextHand.view.legalActions))
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : '行动提交失败')
      } finally {
        setSubmitting(false)
      }
      return
    }

    setNotice(`已记录：${label}`)
    setDemoActions((current) => [
      ...current.filter((item) => item.id !== 'hero-choice'),
      {
        id: 'hero-choice',
        actor: 'Hero',
        action: presentation.label,
        ...(presentation.amount === undefined
          ? {}
          : { amount: presentation.amount }),
        street: '翻牌圈',
        tone: presentation.tone,
      },
    ])
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">PT</span>
          <strong>德州决策训练</strong>
        </a>
        <nav aria-label="主导航">
          <a className="active" href="#table">
            牌桌
          </a>
          <a href="#profiles">玩家画像</a>
          <a href="#reviews">手牌复盘</a>
          <a href="#leaks">Leak 报告</a>
          <a href="#hands">真实牌例</a>
        </nav>
        <div className="top-actions">
          <Link className="new-session-link" href="/new">
            新牌局
          </Link>
          <button className="mode-button" type="button">
            <span>Training</span>
            <small>训练模式</small>
          </button>
          <button
            className="history-button"
            type="button"
            onClick={() => setTimelineOpen(true)}
          >
            <HistoryIcon />
            <span>行动记录</span>
          </button>
          <button
            className="icon-button desktop-only"
            type="button"
            aria-label="设置"
          >
            <SettingsIcon />
          </button>
          <button
            className="icon-button desktop-only"
            type="button"
            aria-label="个人中心"
          >
            <UserIcon />
          </button>
        </div>
      </header>
      {handId !== undefined && (
        <div
          className={`live-state-banner ${loadError === null ? '' : 'error'}`}
          role={loadError === null ? 'status' : 'alert'}
        >
          {loading
            ? '正在恢复真实手牌…'
            : loadError === null
              ? `真实手牌 #${liveHand?.handNo ?? ''} · 数据已连接`
              : `真实手牌未载入：${loadError}`}
        </div>
      )}
      <div className="workspace">
        <div className="primary-column">
          <TableCanvas
            seats={seats}
            boardCards={boardCards}
            heroCards={heroCards}
            pot={pot}
            currentBet={currentBet}
            canShuffleSeats={handId === undefined}
            onShuffleSeats={() =>
              setDemoSeatState((current) => randomizeOpponentSeats(current))
            }
          />
          <div className="mobile-tabs">
            <button
              className="active"
              type="button"
              onClick={() => setTimelineOpen(false)}
            >
              决策
            </button>
            <button type="button" onClick={() => setTimelineOpen(true)}>
              行动
            </button>
          </div>
          <DecisionPanel
            betTo={betTo}
            selectedAction={selectedAction}
            legalActions={legalActions}
            streetLabel={streetLabel}
            pot={pot}
            submitting={
              submitting || (handId !== undefined && liveHand === null)
            }
            onBetToChange={setBetTo}
            onAction={recordAction}
          />
        </div>
        <ActionTimeline
          actions={actions}
          pot={pot}
          open={timelineOpen}
          onClose={() => setTimelineOpen(false)}
        />
      </div>
      {timelineOpen && (
        <button
          className="sheet-scrim"
          type="button"
          aria-label="关闭行动记录"
          onClick={() => setTimelineOpen(false)}
        />
      )}
      {notice && (
        <div className="decision-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setTimelineOpen(true)}>
            查看记录
          </button>
        </div>
      )}
    </main>
  )
}
