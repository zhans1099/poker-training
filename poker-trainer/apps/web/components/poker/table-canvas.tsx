import type { CardData, SeatData } from '../../lib/demo-hand'
import { PlayerSeat } from './player-seat'
import { PlayingCard } from './playing-card'

interface TableCanvasProps {
  seats: readonly SeatData[]
  boardCards: readonly CardData[]
  heroCards: readonly CardData[]
  pot: number
  currentBet: number
  onShuffleSeats: () => void
  canShuffleSeats?: boolean
}

export function TableCanvas({
  seats,
  boardCards,
  heroCards,
  pot,
  currentBet,
  onShuffleSeats,
  canShuffleSeats = true,
}: TableCanvasProps) {
  return (
    <section className="table-stage" aria-label="六人德州扑克牌桌">
      <button
        className="shuffle-seats-button"
        type="button"
        onClick={onShuffleSeats}
        disabled={!canShuffleSeats}
        aria-label="随机更换对手位置"
        title={canShuffleSeats ? undefined : '真实手牌中的座位已经固定'}
      >
        <span aria-hidden="true">↻</span>
        换位置
      </button>
      <div className="table-rail">
        <div className="table-felt">
          {seats.map((seat) => (
            <PlayerSeat key={seat.id} seat={seat} />
          ))}
          <div className="pot-label">
            <span>底池</span>
            <strong>{pot.toLocaleString('en-US')}</strong>
          </div>
          <div className="board-cards">
            {boardCards.map((card) => (
              <PlayingCard key={`${card.rank}-${card.suit}`} card={card} />
            ))}
            <PlayingCard />
            <PlayingCard />
          </div>
          <div className="hero-cards">
            {heroCards.map((card) => (
              <PlayingCard
                key={`${card.rank}-${card.suit}`}
                card={card}
                compact
              />
            ))}
          </div>
          {currentBet > 0 && (
            <span className="bet-chip">
              {currentBet.toLocaleString('en-US')}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
