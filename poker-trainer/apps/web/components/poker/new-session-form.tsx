'use client'

import type { PlayerListItem } from '@poker-trainer/schemas'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createSessionWithFirstHand, fetchPlayers } from '../../lib/game-client'

export function NewSessionForm() {
  const router = useRouter()
  const [players, setPlayers] = useState<PlayerListItem[]>([])
  const [selectedOpponentIds, setSelectedOpponentIds] = useState<string[]>([])
  const [tableSize, setTableSize] = useState<5 | 6>(6)
  const [smallBlind, setSmallBlind] = useState(10)
  const [bigBlind, setBigBlind] = useState(20)
  const [startingStack, setStartingStack] = useState(2000)
  const [randomizeSeats, setRandomizeSeats] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchPlayers(controller.signal)
      .then((data) => {
        setPlayers(data)
        setSelectedOpponentIds(
          data
            .filter((player) => player.kind === 'OPPONENT')
            .slice(0, 5)
            .map((player) => player.id),
        )
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : '玩家列表加载失败',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const hero = players.find((player) => player.kind === 'HERO')
  const opponents = useMemo(
    () => players.filter((player) => player.kind === 'OPPONENT'),
    [players],
  )
  const requiredOpponents = tableSize - 1
  const selectedOpponents = selectedOpponentIds
    .map((id) => opponents.find((player) => player.id === id))
    .filter((player): player is PlayerListItem => player !== undefined)
    .slice(0, requiredOpponents)
  const selectionComplete =
    hero !== undefined && selectedOpponents.length === requiredOpponents

  function changeTableSize(size: 5 | 6) {
    setTableSize(size)
    setSelectedOpponentIds((current) => {
      const next = current.slice(0, size - 1)
      for (const opponent of opponents) {
        if (next.length >= size - 1) break
        if (!next.includes(opponent.id)) next.push(opponent.id)
      }
      return next
    })
  }

  function toggleOpponent(id: string) {
    setSelectedOpponentIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id)
      if (current.length >= requiredOpponents) return current
      return [...current, id]
    })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectionComplete || hero === undefined) return
    setSubmitting(true)
    setError(null)
    try {
      const participants = [hero, ...selectedOpponents].map(
        (player, index) => ({
          playerId: player.id,
          seatNo: index + 1,
          stack: startingStack,
        }),
      )
      const hand = await createSessionWithFirstHand({
        session: {
          tableSize,
          smallBlind,
          bigBlind,
          startingStack,
          config: { trainingMode: 'TRAINING' },
          participants,
        },
        buttonSeat: 1,
        randomizeSeats,
      })
      router.push(`/?handId=${encodeURIComponent(hand.id)}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '牌局创建失败')
      setSubmitting(false)
    }
  }

  return (
    <main className="setup-shell">
      <header className="setup-header">
        <Link className="brand" href="/">
          <span className="brand-mark">PT</span>
          <strong>德州决策训练</strong>
        </Link>
        <Link className="setup-back" href="/">
          返回牌桌
        </Link>
      </header>
      <form className="setup-card" onSubmit={(event) => void submit(event)}>
        <div className="setup-title">
          <span className="eyebrow">NEW TRAINING SESSION</span>
          <h1>创建新牌局</h1>
          <p>选择固定熟人、设置筹码，并决定本手是否随机换位。</p>
        </div>

        {error && (
          <div className="setup-error" role="alert">
            {error}
          </div>
        )}

        <section className="setup-section" aria-labelledby="table-config-title">
          <div className="setup-section-heading">
            <span>01</span>
            <div>
              <h2 id="table-config-title">牌桌配置</h2>
              <p>盲注采用 bet-to 语义，所有筹码必须是整数。</p>
            </div>
          </div>
          <div className="setup-fields">
            <label>
              <span>人数</span>
              <select
                value={tableSize}
                onChange={(event) =>
                  changeTableSize(Number(event.target.value) as 5 | 6)
                }
              >
                <option value={6}>6 人桌</option>
                <option value={5}>5 人桌</option>
              </select>
            </label>
            <label>
              <span>小盲</span>
              <input
                type="number"
                min={1}
                value={smallBlind}
                onChange={(event) => setSmallBlind(Number(event.target.value))}
              />
            </label>
            <label>
              <span>大盲</span>
              <input
                type="number"
                min={2}
                value={bigBlind}
                onChange={(event) => setBigBlind(Number(event.target.value))}
              />
            </label>
            <label>
              <span>每人初始筹码</span>
              <input
                type="number"
                min={1}
                value={startingStack}
                onChange={(event) =>
                  setStartingStack(Number(event.target.value))
                }
              />
            </label>
          </div>
        </section>

        <section className="setup-section" aria-labelledby="players-title">
          <div className="setup-section-heading">
            <span>02</span>
            <div>
              <h2 id="players-title">选择玩家</h2>
              <p>
                Hero 自动入座；请选择 {requiredOpponents} 名对手。已选择{' '}
                {selectedOpponents.length}/{requiredOpponents}。
              </p>
            </div>
          </div>
          {loading ? (
            <div className="setup-loading" role="status">
              正在加载数据库玩家…
            </div>
          ) : (
            <div className="player-picker">
              {hero && (
                <div className="player-option selected hero-option">
                  <span className="player-order">1</span>
                  <div>
                    <strong>{hero.displayName}</strong>
                    <small>Hero · 固定加入</small>
                  </div>
                  <span className="player-check">✓</span>
                </div>
              )}
              {opponents.map((player) => {
                const selectedIndex = selectedOpponentIds.indexOf(player.id)
                const selected = selectedIndex >= 0
                const disabled =
                  !selected && selectedOpponentIds.length >= requiredOpponents
                return (
                  <label
                    className={`player-option ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                    key={player.id}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => toggleOpponent(player.id)}
                    />
                    <span className="player-order">
                      {selected ? selectedIndex + 2 : '–'}
                    </span>
                    <div>
                      <strong>{player.displayName}</strong>
                      <small>{player.code}</small>
                    </div>
                    <span className="player-check">{selected ? '✓' : '+'}</span>
                  </label>
                )
              })}
            </div>
          )}
        </section>

        <section className="setup-section" aria-labelledby="seating-title">
          <div className="setup-section-heading">
            <span>03</span>
            <div>
              <h2 id="seating-title">座位方式</h2>
              <p>固定位置保持当前顺序；随机换位只在点击发牌时执行一次。</p>
            </div>
          </div>
          <div className="seating-options">
            <label className={!randomizeSeats ? 'selected' : ''}>
              <input
                type="radio"
                name="seating"
                checked={!randomizeSeats}
                onChange={() => setRandomizeSeats(false)}
              />
              <strong>固定位置</strong>
              <small>按上方编号入座</small>
            </label>
            <label className={randomizeSeats ? 'selected' : ''}>
              <input
                type="radio"
                name="seating"
                checked={randomizeSeats}
                onChange={() => setRandomizeSeats(true)}
              />
              <strong>↻ 随机换位置</strong>
              <small>发牌前随机重排一次，之后保持不变</small>
            </label>
          </div>
        </section>

        <div className="setup-submit-row">
          <span>
            {selectionComplete
              ? `已准备 ${tableSize} 人桌 · ${smallBlind}/${bigBlind}`
              : '请完成玩家选择'}
          </span>
          <button
            type="submit"
            disabled={
              loading ||
              submitting ||
              !selectionComplete ||
              bigBlind <= smallBlind ||
              startingStack < bigBlind
            }
          >
            {submitting ? '正在创建…' : '创建牌局并发牌'}
          </button>
        </div>
      </form>
    </main>
  )
}
