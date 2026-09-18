'use client'

import type { HandReviewRecord } from '@poker-trainer/schemas'
import { useEffect, useState } from 'react'
import { createHandReview, fetchHandReviews } from '../../lib/game-client'

const verdictLabels = {
  GOOD: '合理',
  MIXED: '可讨论',
  ERROR: '需改进',
} as const

export function HandReviewPanel({
  handId,
  onFeedbackCreated,
}: {
  handId: string
  onFeedbackCreated?: (() => void) | undefined
}) {
  const [reviews, setReviews] = useState<HandReviewRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetchHandReviews(handId, controller.signal)
      .then(setReviews)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : '复盘加载失败')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [handId])

  async function generateReview() {
    setGenerating(true)
    setError(null)
    try {
      const review = await createHandReview(handId)
      setReviews((current) => [review, ...current])
      onFeedbackCreated?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '复盘生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const latest = reviews[0]
  return (
    <section className="hand-review-panel" id="reviews">
      <div className="review-heading">
        <div>
          <span className="eyebrow">DEEP REVIEW</span>
          <h2>整手复盘</h2>
          <p>基于公开行动与 Hero 当时可见信息，由 DeepSeek 生成。</p>
        </div>
        <button
          type="button"
          disabled={generating}
          onClick={() => void generateReview()}
        >
          {generating
            ? '正在复盘…'
            : latest === undefined
              ? '生成复盘'
              : '重新复盘'}
        </button>
      </div>
      {error !== null ? <p className="review-error">{error}</p> : null}
      {loading ? (
        <p className="review-empty">正在读取历史复盘…</p>
      ) : latest === undefined ? (
        <p className="review-empty">
          点击后会将本手公开记录和你的决策信息发送给已配置的 DeepSeek。
        </p>
      ) : (
        <div className="review-content">
          <div className="review-summary">
            <span>第 {latest.version} 版</span>
            <strong>{latest.review.summary}</strong>
            <small>
              {latest.model} · {latest.review.audit?.latencyMs ?? 0} ms
            </small>
          </div>
          <div className="review-decisions">
            {latest.review.decisionReviews.map((decision) => (
              <article key={`${decision.eventSequence}-${decision.street}`}>
                <span
                  className={`review-verdict ${decision.verdict.toLowerCase()}`}
                >
                  {verdictLabels[decision.verdict]}
                </span>
                <div>
                  <strong>
                    {decision.street} · 决策 #{decision.eventSequence}
                  </strong>
                  <p>{decision.explanation}</p>
                  <small>建议：{decision.recommendedAction}</small>
                </div>
              </article>
            ))}
          </div>
          {latest.review.leaks.length > 0 ? (
            <div className="review-leaks">
              <h3>需要关注的 Leak</h3>
              {latest.review.leaks.map((leak) => (
                <article key={`${leak.code}-${leak.street}`}>
                  <strong>
                    {leak.code} · {leak.street} · S{leak.severity}
                  </strong>
                  <p>{leak.evidence}</p>
                  <small>{leak.recommendation}</small>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
