import type { SeatData } from '../../lib/demo-hand'

export function PlayerSeat({ seat }: { seat: SeatData }) {
  return (
    <div
      className={`player-seat seat-${seat.id} ${seat.hero ? 'hero' : ''} ${seat.active ? 'active' : ''} ${seat.folded ? 'folded' : ''}`}
    >
      {!seat.hero && (
        <div className="hole-cards" aria-hidden="true">
          <i />
          <i />
        </div>
      )}
      <div className="seat-chip">
        <strong>{seat.name}</strong>
        <span>{seat.stack.toLocaleString('en-US')}</span>
      </div>
      {seat.status && (
        <span className={`position-token token-${seat.status.toLowerCase()}`}>
          {seat.status}
        </span>
      )}
      {seat.hero && <span className="turn-token">行动中</span>}
    </div>
  )
}
