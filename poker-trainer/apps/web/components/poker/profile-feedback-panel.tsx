'use client'

import type { ProfileFeedbackRecord } from '@poker-trainer/schemas'
import { useEffect, useState } from 'react'
import {
  fetchHandProfileFeedback,
  resolveProfileFeedback,
} from '../../lib/game-client'

const statusLabels = {
  PENDING: '待你确认',
  ACCEPTED: '已应用',
  REJECTED: '已忽略',
} as const

export function ProfileFeedbackPanel({
  handId,
  refreshKey,
}: {
  handId: string
  refreshKey: number
}) {
  const [feedback, setFeedback] = useState<ProfileFeedbackRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchHandProfileFeedback(handId, controller.signal)
      .then(setFeedback)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : '画像建议加载失败')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [handId, refreshKey])

  async function resolve(
    item: ProfileFeedbackRecord,
    resolution: 'ACCEPT' | 'REJECT',
  ) {
    setResolvingId(item.id)
    setError(null)
    try {
      const updated = await resolveProfileFeedback(
        item.playerId,
        item.id,
        resolution,
      )
      setFeedback((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, ...updated } : entry,
        ),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '画像建议处理失败')
    } finally {
      setResolvingId(null)
    }
  }

  const pendingCount = feedback.filter(
    (item) => item.status === 'PENDING',
  ).length
  return (
    <section className="profile-feedback-panel" id="profiles">
      <div className="profile-feedback-heading">
        <div>
          <span className="eyebrow">PERSONA CALIBRATION</span>
          <h2>人物画像建议</h2>
          <p>复盘观察默认不会改画像；接受后才创建并启用新版本。</p>
        </div>
        {pendingCount > 0 ? <strong>{pendingCount} 条待确认</strong> : null}
      </div>
      {error !== null ? <p className="review-error">{error}</p> : null}
      {loading ? (
        <p className="review-empty">正在读取画像建议…</p>
      ) : feedback.length === 0 ? (
        <p className="review-empty">本手暂未产生可信的人物画像观察。</p>
      ) : (
        <div className="profile-feedback-list">
          {feedback.map((item) => {
            const resolving = resolvingId === item.id
            return (
              <article key={item.id}>
                <div className="profile-feedback-copy">
                  <div className="profile-feedback-meta">
                    <strong>{item.player?.displayName ?? item.playerId}</strong>
                    <span>{Math.round(item.confidence * 100)}% 置信度</span>
                    <span
                      className={`feedback-status ${item.status.toLowerCase()}`}
                    >
                      {statusLabels[item.status]}
                    </span>
                  </div>
                  <p>{item.observation}</p>
                  {item.status === 'ACCEPTED' ? (
                    <small>已生成新的正式画像版本，后续对局会使用。</small>
                  ) : null}
                </div>
                {item.status === 'PENDING' ? (
                  <div className="profile-feedback-actions">
                    <button
                      type="button"
                      disabled={resolving}
                      className="feedback-reject"
                      onClick={() => void resolve(item, 'REJECT')}
                    >
                      忽略
                    </button>
                    <button
                      type="button"
                      disabled={resolving}
                      className="feedback-accept"
                      onClick={() => void resolve(item, 'ACCEPT')}
                    >
                      {resolving ? '处理中…' : '接受并应用'}
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
