import type { LegalActionSet } from '@poker-trainer/domain'
import type {
  HeroThoughtInput,
  PlayerActionInput,
} from '@poker-trainer/schemas'
import { useState } from 'react'
import { ChevronIcon } from './icons'

interface DecisionPanelProps {
  betTo: number
  selectedAction: PlayerActionInput['type'] | null
  legalActions: LegalActionSet
  streetLabel: string
  pot: number
  submitting: boolean
  onBetToChange: (value: number) => void
  onAction: (
    action: PlayerActionInput,
    thoughtInput: HeroThoughtInput,
  ) => void | Promise<void>
}

export function DecisionPanel({
  betTo,
  selectedAction,
  legalActions,
  streetLabel,
  pot,
  submitting,
  onBetToChange,
  onAction,
}: DecisionPanelProps) {
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [note, setNote] = useState('')
  const [rangeStrength, setRangeStrength] = useState<
    'WEAK' | 'MEDIUM' | 'STRONG' | 'NUTS'
  >('MEDIUM')
  const [purpose, setPurpose] = useState<
    'BLUFF' | 'SEMI_BLUFF' | 'PROTECTION' | 'VALUE' | 'POT_CONTROL'
  >('VALUE')
  const [equity, setEquity] = useState(48)

  const potOdds =
    legalActions.callAmount === 0
      ? 0
      : legalActions.callAmount / (pot + legalActions.callAmount)
  const minAggressiveTo =
    legalActions.minBetTo ?? legalActions.minRaiseTo ?? legalActions.maxTo
  const canAggress = legalActions.canBet || legalActions.canRaise
  const aggressiveType = legalActions.canBet ? 'BET' : 'RAISE'

  function thoughtInput(): HeroThoughtInput {
    const trimmedNote = note.trim()
    if (!comparisonOpen) {
      return {
        mode: 'QUICK',
        ...(trimmedNote.length === 0 ? {} : { note: trimmedNote }),
      }
    }
    return {
      mode: 'TRAINING',
      ...(trimmedNote.length === 0 ? {} : { note: trimmedNote }),
      rangeStrength,
      purpose,
      potOddsEstimate: potOdds,
      equityEstimate: equity / 100,
    }
  }

  function choose(action: PlayerActionInput) {
    void onAction(action, thoughtInput())
  }

  return (
    <section className="decision-workspace" aria-labelledby="decision-title">
      <div className="decision-heading">
        <div>
          <span className="eyebrow">轮到 Hero · {streetLabel}</span>
          <h2 id="decision-title">决策思考</h2>
        </div>
        <p>先记录判断，再选择行动</p>
      </div>
      <div className="decision-grid">
        <label className="thought-field">
          <span>
            先写下你的思考 <em>（可选）</em>
          </span>
          <textarea
            placeholder="对手是什么范围？我为什么要这样行动？"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button
          className={`comparison-toggle ${comparisonOpen ? 'open' : ''}`}
          type="button"
          onClick={() => setComparisonOpen((value) => !value)}
          aria-expanded={comparisonOpen}
        >
          <span>
            <strong>
              {comparisonOpen ? '收起判断对比' : '我思考好了，展开对比'}
            </strong>
            <small>再查看范围、行动目的、赔率与胜率</small>
          </span>
          <ChevronIcon />
        </button>
        {comparisonOpen && (
          <div className="comparison-fields">
            <label className="field-card">
              <span>我的手牌范围强度</span>
              <select
                value={rangeStrength}
                onChange={(event) =>
                  setRangeStrength(event.target.value as typeof rangeStrength)
                }
              >
                <option value="WEAK">偏弱</option>
                <option value="MEDIUM">中等偏强</option>
                <option value="STRONG">强牌</option>
                <option value="NUTS">坚果</option>
              </select>
              <small>基于当前行动和公共牌面评估</small>
            </label>
            <label className="field-card">
              <span>本次行动目的</span>
              <select
                value={purpose}
                onChange={(event) =>
                  setPurpose(event.target.value as typeof purpose)
                }
              >
                <option value="BLUFF">诈唬</option>
                <option value="SEMI_BLUFF">半诈唬</option>
                <option value="PROTECTION">保护权益</option>
                <option value="VALUE">价值下注</option>
                <option value="POT_CONTROL">底池控制</option>
              </select>
              <small>选择这次行动的主要目的</small>
            </label>
            <div className="metric-card">
              <span>底池赔率</span>
              <strong>{(potOdds * 100).toFixed(1)}%</strong>
              <small>
                需要 {legalActions.callAmount.toLocaleString('en-US')} /{' '}
                {pot.toLocaleString('en-US')}
              </small>
            </div>
            <label className="metric-card equity-field">
              <span>胜率估算 (Equity)</span>
              <strong>
                <input
                  type="number"
                  value={equity}
                  min="0"
                  max="100"
                  aria-label="胜率估算"
                  onChange={(event) =>
                    setEquity(
                      Math.min(100, Math.max(0, Number(event.target.value))),
                    )
                  }
                />
                %
              </strong>
              <small>与系统分析对比</small>
            </label>
          </div>
        )}
      </div>
      <div className="action-console">
        <div className="action-console-heading">
          <strong>选择行动</strong>
          <span>
            {legalActions.callAmount > 0
              ? `面对下注 ${legalActions.callTo?.toLocaleString('en-US') ?? ''}`
              : '当前无人下注'}
          </span>
        </div>
        <div className="action-buttons">
          <button
            type="button"
            disabled={submitting || !legalActions.canFold}
            className={selectedAction === 'FOLD' ? 'selected' : ''}
            onClick={() => choose({ type: 'FOLD' })}
          >
            弃牌
          </button>
          <button
            type="button"
            disabled={submitting || !legalActions.canCheck}
            className={selectedAction === 'CHECK' ? 'selected' : ''}
            onClick={() => choose({ type: 'CHECK' })}
          >
            过牌
          </button>
          <button
            type="button"
            disabled={
              submitting ||
              !legalActions.canCall ||
              legalActions.callTo === null
            }
            className={`call ${selectedAction === 'CALL' ? 'selected' : ''}`}
            onClick={() =>
              legalActions.callTo === null
                ? undefined
                : choose({ type: 'CALL', to: legalActions.callTo })
            }
          >
            跟注 <span>{legalActions.callAmount.toLocaleString('en-US')}</span>
          </button>
          <button
            type="button"
            disabled={submitting || !canAggress}
            className={selectedAction === aggressiveType ? 'selected' : ''}
            onClick={() => choose({ type: aggressiveType, to: betTo })}
          >
            {legalActions.canBet ? '下注' : '加注'}{' '}
            <span>{betTo.toLocaleString('en-US')}</span>
            <ChevronIcon />
          </button>
          <button
            type="button"
            disabled={submitting || !legalActions.canAllIn}
            className={`all-in ${selectedAction === 'ALL_IN' ? 'selected' : ''}`}
            onClick={() => choose({ type: 'ALL_IN', to: legalActions.maxTo })}
          >
            All-in <span>{legalActions.maxTo.toLocaleString('en-US')}</span>
          </button>
        </div>
        {canAggress && (
          <label className="bet-slider">
            <span>
              {legalActions.canBet ? '下注到' : '加注到'}{' '}
              <output>{betTo.toLocaleString('en-US')}</output>
            </span>
            <input
              type="range"
              min={minAggressiveTo}
              max={legalActions.maxTo}
              step={1}
              value={betTo}
              onChange={(event) => onBetToChange(Number(event.target.value))}
            />
            <small>
              <span>{minAggressiveTo.toLocaleString('en-US')}</span>
              <span>{legalActions.maxTo.toLocaleString('en-US')}</span>
            </small>
          </label>
        )}
      </div>
    </section>
  )
}
