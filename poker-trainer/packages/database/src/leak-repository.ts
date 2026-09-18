import { getPrisma } from './client'

interface ReviewLeak {
  code: string
  street: string
  severity: number
  evidence: string
  recommendation: string
}

function reviewLeaks(value: unknown): ReviewLeak[] {
  if (typeof value !== 'object' || value === null || !('leaks' in value))
    return []
  const leaks: unknown = value.leaks
  if (!Array.isArray(leaks)) return []
  return leaks.filter(
    (leak: unknown): leak is ReviewLeak =>
      typeof leak === 'object' &&
      leak !== null &&
      'code' in leak &&
      typeof leak.code === 'string' &&
      'street' in leak &&
      typeof leak.street === 'string' &&
      'severity' in leak &&
      typeof leak.severity === 'number' &&
      'evidence' in leak &&
      typeof leak.evidence === 'string' &&
      'recommendation' in leak &&
      typeof leak.recommendation === 'string',
  )
}

export class LeakRepository {
  async dashboard() {
    const reviews = await getPrisma().handReview.findMany({
      include: {
        hand: {
          select: {
            id: true,
            handNo: true,
            sessionId: true,
            completedAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
      take: 500,
    })
    const latestByHand = new Map<string, (typeof reviews)[number]>()
    for (const review of reviews) {
      if (!latestByHand.has(review.handId))
        latestByHand.set(review.handId, review)
    }
    const groups = new Map<
      string,
      {
        code: string
        street: string
        count: number
        totalSeverity: number
        maxSeverity: number
        latestEvidence: string
        recommendation: string
        hands: Array<{
          id: string
          handNo: number
          sessionId: string
          completedAt: Date | null
        }>
      }
    >()
    for (const review of latestByHand.values()) {
      for (const leak of reviewLeaks(review.review)) {
        const key = `${leak.code}:${leak.street}`
        const group = groups.get(key) ?? {
          code: leak.code,
          street: leak.street,
          count: 0,
          totalSeverity: 0,
          maxSeverity: 0,
          latestEvidence: leak.evidence,
          recommendation: leak.recommendation,
          hands: [],
        }
        group.count += 1
        group.totalSeverity += leak.severity
        group.maxSeverity = Math.max(group.maxSeverity, leak.severity)
        group.hands.push(review.hand)
        groups.set(key, group)
      }
    }
    return [...groups.values()]
      .map(({ totalSeverity, ...group }) => ({
        ...group,
        averageSeverity: Math.round((totalSeverity / group.count) * 10) / 10,
      }))
      .sort(
        (left, right) =>
          right.maxSeverity - left.maxSeverity || right.count - left.count,
      )
  }
}
