import type { ActionEvent } from '../../lib/demo-hand'
import { CloseIcon } from './icons'

export function ActionTimeline({
  actions,
  pot,
  open,
  onClose,
}: {
  actions: ActionEvent[]
  pot: number
  open: boolean
  onClose: () => void
}) {
  return (
    <aside
      className={`timeline-panel ${open ? 'open' : ''}`}
      aria-label="行动记录"
    >
      <div className="timeline-heading">
        <div>
          <span className="eyebrow">本手牌</span>
          <h2>行动记录</h2>
        </div>
        <button
          className="icon-button mobile-only"
          type="button"
          onClick={onClose}
          aria-label="关闭行动记录"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="street-divider">
        <span>翻牌前</span>
      </div>
      <ol className="action-list">
        {actions.map((item, index) => {
          const previous = actions[index - 1]
          const showStreet = index > 0 && previous?.street !== item.street
          return (
            <li key={item.id}>
              {showStreet && (
                <div className="street-divider">
                  <span>{item.street}</span>
                </div>
              )}
              <div className={`action-row ${item.tone ?? ''}`}>
                <span className="actor-dot">{item.actor.slice(0, 1)}</span>
                <div>
                  <strong>{item.actor}</strong>
                  <span>
                    {item.action}
                    {item.amount ? ` ${item.amount}` : ''}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="timeline-summary">
        <span>当前底池</span>
        <strong>{pot.toLocaleString('en-US')}</strong>
      </div>
    </aside>
  )
}
