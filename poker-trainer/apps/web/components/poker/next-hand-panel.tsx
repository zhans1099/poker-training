'use client'

import { useState } from 'react'

interface NextHandPanelProps {
  handNo: number
  fundedPlayerCount: number
  submitting: boolean
  onStart: (randomizeSeats: boolean) => void | Promise<void>
}

export function NextHandPanel({
  handNo,
  fundedPlayerCount,
  submitting,
  onStart,
}: NextHandPanelProps) {
  const [randomizeSeats, setRandomizeSeats] = useState(false)
  const canContinue = fundedPlayerCount >= 2

  return (
    <section className="next-hand-panel" aria-labelledby="next-hand-title">
      <div>
        <span className="eyebrow">第 {handNo} 手牌结束</span>
        <h2 id="next-hand-title">继续下一手</h2>
        <p>结算筹码已经保存。下一手将自动顺延庄位，并沿用当前玩家筹码。</p>
      </div>
      <label className="next-hand-randomize">
        <input
          type="checkbox"
          checked={randomizeSeats}
          disabled={submitting || !canContinue}
          onChange={(event) => setRandomizeSeats(event.target.checked)}
        />
        <span>
          <strong>重新随机换位</strong>
          <small>不勾选时保持本手座位不变</small>
        </span>
      </label>
      <button
        className="next-hand-button"
        type="button"
        disabled={submitting || !canContinue}
        onClick={() => void onStart(randomizeSeats)}
      >
        {submitting ? '正在发牌…' : '开始下一手'}
      </button>
      {!canContinue && (
        <p className="next-hand-warning" role="status">
          当前不足两名有筹码玩家，请新建牌局或补充筹码。
        </p>
      )}
    </section>
  )
}
