import type { CardData } from '../../lib/demo-hand'

const suitMap = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' } as const

export function PlayingCard({
  card,
  compact = false,
}: {
  card?: CardData
  compact?: boolean
}) {
  if (!card)
    return (
      <span
        className={`playing-card empty ${compact ? 'compact' : ''}`}
        aria-hidden="true"
      />
    )
  return (
    <span
      className={`playing-card ${card.suit} ${compact ? 'compact' : ''}`}
      aria-label={`${card.rank}${suitMap[card.suit]}`}
    >
      <strong>{card.rank}</strong>
      <span>{suitMap[card.suit]}</span>
    </span>
  )
}
