'use client'

import type { LeakDashboardItem } from '@poker-trainer/schemas'
import { useEffect, useState } from 'react'
import { fetchLeakDashboard } from '../../lib/game-client'

export function LeakDashboard({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<LeakDashboardItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchLeakDashboard(controller.signal)
      .then(setItems)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Leak 汇总加载失败')
        }
      })
    return () => controller.abort()
  }, [refreshKey])

  return (
    <section className="leak-dashboard" id="leaks">
      <div className="leak-dashboard-heading">
        <div>
          <span className="eyebrow">LEAK DASHBOARD</span>
          <h2>决策漏洞汇总</h2>
          <p>每手只统计最新复盘版本，避免重新复盘导致重复计数。</p>
        </div>
        <strong>{items.reduce((sum, item) => sum + item.count, 0)} 次</strong>
      </div>
      {error !== null ? <p className="review-error">{error}</p> : null}
      {items.length === 0 && error === null ? (
        <p className="review-empty">完成复盘后，这里会聚合你的重复决策漏洞。</p>
      ) : (
        <div className="leak-dashboard-grid">
          {items.map((item) => (
            <article key={`${item.code}-${item.street}`}>
              <div className="leak-dashboard-meta">
                <span>{item.street}</span>
                <span>最高 S{item.maxSeverity}</span>
                <span>{item.count} 次</span>
              </div>
              <h3>{item.code}</h3>
              <p>{item.latestEvidence}</p>
              <small>{item.recommendation}</small>
              <div className="leak-hand-links">
                {item.hands.slice(0, 5).map((hand) => (
                  <a
                    key={hand.id}
                    href={`/?handId=${encodeURIComponent(hand.id)}`}
                  >
                    牌例 #{hand.handNo}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
