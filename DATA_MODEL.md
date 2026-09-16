# 固定熟人德州扑克决策训练器：数据模型

> 本文描述领域模型、持久化模型及数据生命周期。字段名使用 TypeScript/Prisma 风格，最终 schema 允许做机械性调整，但语义不应漂移。

## 1. 建模原则

1. 金额全部使用整数筹码单位，禁止浮点金额。
2. 百分比/频率在领域层统一为 `[0, 1]`；UI 百分数只在边界转换。
3. 历史可追踪：手牌引用不可变版本，而不是“当前画像/当前 Prompt”。
4. 事件追加写；摘要和 snapshot 可重建。
5. 私有牌与公开事件分开存储，API 默认不返回私有 payload。
6. JSON 只存高变化、低查询价值的数据；需要筛选/聚合的字段关系化。
7. SQLite V1 中枚举以字符串 + 应用层 Zod 约束；迁移 PostgreSQL 时可再评估原生 enum。

## 2. 领域值对象

```ts
type PlayerId = string
type HandId = string
type Chips = number // safe integer, >= 0
type Probability = number // 0..1
type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN'
type Suit = 'c' | 'd' | 'h' | 's'
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A'
type Card = `${Rank}${Suit}`

type PlayerAction =
  | { type: 'FOLD' }
  | { type: 'CHECK' }
  | { type: 'CALL'; to: Chips }
  | { type: 'BET'; to: Chips }
  | { type: 'RAISE'; to: Chips }
  | { type: 'ALL_IN'; to: Chips }
```

数据库金额用 `Int` 即可覆盖当前娱乐局；若未来可能超过 21 亿筹码，迁移为 `BigInt`。领域层所有运算必须检查 `Number.isSafeInteger`。

## 3. Player Profile

画像分为四层：身份、静态版本、session 动态状态、actor-specific read。

### 3.1 静态画像

```ts
interface PlayerProfileParams {
  // Preflop
  vpip: Probability
  pfr: Probability
  threeBetFrequency: Probability
  fourBetFrequency: Probability
  foldToThreeBet: Probability
  callThreeBetFrequency: Probability
  fourBetBluffFrequency: Probability
  foldToFourBet: Probability
  limpFrequency: Probability
  coldCallFrequency: Probability
  squeezeFrequency: Probability

  // Postflop
  aggressionFactor: Probability
  flopCbetFrequency: Probability
  turnBarrelFrequency: Probability
  riverBarrelFrequency: Probability
  foldToBet: Probability
  foldToRaise: Probability
  drawChasing: Probability
  topPairStickiness: Probability
  middlePairStickiness: Probability
  heroCallFrequency: Probability
  bluffFrequency: Probability
  semiBluffFrequency: Probability
  largeBetBluffFrequency: Probability
  overbetFrequency: Probability
  allInBluffFrequency: Probability
  slowPlayFrequency: Probability
  trapFrequency: Probability
  flopCheckRaiseFrequency: Probability
  turnCheckRaiseFrequency: Probability
  riverCheckRaiseFrequency: Probability
  checkRaiseBluffFrequency: Probability
  foldToCheckRaise: Probability

  // Mental tendencies
  tiltSensitivity: Probability
  lossChasing: Probability
  riskTolerance: Probability

  tags: string[]
}

interface ProfileVersion {
  id: string
  playerId: PlayerId
  version: number
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED'
  params: PlayerProfileParams
  changeReason: string | null
  basedOnFeedbackIds: string[]
  createdAt: string
}
```

`threeBetFrequency`、`fourBetFrequency`、各街 `*CheckRaiseFrequency` 等是画像倾向，不是某一次决策的机械概率。实际 prior 必须同时考虑位置、有效筹码、牌力/听牌、单挑或多人池、下注尺度、行动历史和动态状态。value、bluff、semi-bluff 的组成也必须受牌力 gate 约束，不能仅凭画像频率产生无条件激进行动。

所有字段 V1 都提供显式默认值，避免 `undefined` 在 prior 中被误当 0。建议初值：

| 玩家 | 画像方向 | 需要补齐的 V1 默认 |
|---|---|---|
| Z | 极松凶、追 draw、上头放大风险 | squeeze .18, cbet .72, turn .62, river .48, overbet .22 |
| J | 松粘被动、对 Hero bluff-catch | squeeze .05, cbet .42, turn .30, river .22, overbet .08 |
| L | 理性、有结构、非 solver | limp .12, cold call .28, squeeze .11, cbet .58, turn .46, river .38, overbet .13 |
| P | 比 L 稳 | VPIP .30, PFR .21, 3bet .08, aggression .46, bluff .25, risk .40 |
| H | 中等偏稳、信息不足 | VPIP .38, PFR .22, 3bet .07, aggression .43, bluff .22, risk .42 |

这些是启动先验，不是“真实结论”；必须可编辑、可版本化。

### 3.2 动态状态

```ts
interface PlayerSessionState {
  playerId: PlayerId
  sessionId: string
  stack: Chips
  sessionProfitLoss: number
  tiltLevel: Probability
  confidenceLevel: Probability
  recentLossCount: number
  recentWinCount: number
  recentlyCaughtBluffing: boolean
  recentlyCaughtHeroBluffing: boolean
  recentAggressionScore: Probability
  recentHandsSummary: string[] // capped, e.g. last 10
  rebuyCount: number
  version: number
}
```

动态状态更新由确定性 reducer 完成。自然语言 summary 是辅助上下文，不能反向覆盖数值真相。

### 3.3 对 Hero 的特殊 Read

不是一个全局 `heroImageAdjustment`，而是每个观察者独立维护：

```ts
interface OpponentRead {
  observerPlayerId: PlayerId
  subjectPlayerId: PlayerId // V1 重点是 Hero
  sessionId: string | null // null = 长期基础 read
  perceivedLooseness: Probability
  perceivedBluffFrequency: Probability
  largeBetBluffReputation: Probability
  heroCallReputation: Probability
  aggressionReputation: Probability
  confidence: Probability
  evidenceCount: number
  updatedAt: string
}
```

Session read 从长期 read 拷贝，依据公开 showdown 和近期行动做小幅、有上限的更新。未摊牌的真实 hole cards不能成为对手 read 的证据。

## 4. Game State

`GameState` 是运行时权威对象；数据库 snapshot 存其 schema-versioned JSON。

```ts
interface GameState {
  schemaVersion: 1
  engineVersion: string
  handId: HandId
  sessionId: string
  handNo: number
  version: number

  phase: 'HAND_SETUP' | 'POSTING_BLINDS' | 'BETTING' |
    'DEALING' | 'SHOWDOWN' | 'SETTLEMENT' | 'COMPLETE' | 'FROZEN'
  street: Street
  buttonSeat: number
  smallBlind: Chips
  bigBlind: Chips

  seats: SeatState[]
  board: Card[]
  burnCards: Card[]
  deck: Card[]
  currentActorSeat: number | null
  actionQueue: number[]

  currentBet: Chips
  lastFullRaiseSize: Chips
  lastFullAggressorSeat: number | null
  actedSinceLastFullRaise: number[]
  streetContributions: Record<PlayerId, Chips>
  totalContributions: Record<PlayerId, Chips>
  pots: Pot[]

  eventsApplied: number
  seedRef: string
}

interface SeatState {
  seat: number
  playerId: PlayerId
  stack: Chips
  holeCards: Card[] // only in server/private state
  status: 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'SITTING_OUT'
  committedThisStreet: Chips
  committedThisHand: Chips
}

interface Pot {
  index: number
  amount: Chips
  eligiblePlayerIds: PlayerId[]
  contributionCap: Chips
}
```

`pot` 不作为独立可写字段；展示值为 pots/贡献 ledger 的派生结果。

## 5. 训练输入

### 5.1 决策点策略语义

规则引擎只接受 `CHECK/BET/CALL/RAISE/FOLD/ALL_IN` 等标准动作；训练、画像和统计层根据完整行动历史确定性推导策略语义：

```ts
type DecisionSpot =
  | 'OPEN_RAISE'
  | 'THREE_BET'
  | 'FOUR_BET'
  | 'FIVE_BET_PLUS'
  | 'SQUEEZE'
  | 'LIMP_RERAISE'
  | 'BACK_RAISE'
  | 'CHECK_RAISE'
  | 'RERAISE_POSTFLOP'
  | 'CBET'
  | 'DELAYED_CBET'
  | 'DONK_BET'
  | 'PROBE_BET'
  | 'DOUBLE_BARREL'
  | 'TRIPLE_BARREL'
```

- Preflop 首次非盲注加注为 open raise；对其再加注为 3bet，再加注为 4bet，依次类推。
- 玩家本街先 check，面对后位 bet 后再 raise，才标记为 check-raise。
- Squeeze、limp-reraise、back-raise 必须根据此前参与方式和行动顺序识别。
- `DecisionSpot` 是从事件日志重建的派生事实，不由客户端或 AI 自报，也不改变底层合法动作语义。
- 每个 `HeroDecision` 和 `AiDecision` 保存推导出的 spot/version，保证复盘和统计口径可追踪。

```ts
type TrainingMode = 'QUICK' | 'TRAINING' | 'DEEP'
type RangeStrength = 'VERY_WEAK' | 'WEAK' | 'MEDIUM' | 'STRONG' | 'VERY_STRONG'
type ActionPurpose = 'VALUE' | 'BLUFF' | 'SEMI_BLUFF' | 'PROTECTION' |
  'DENY_EQUITY' | 'POT_CONTROL' | 'TRAP'

interface HeroThoughtInput {
  mode: TrainingMode
  rangeStrength?: RangeStrength
  purpose?: ActionPurpose
  estimatedPotOdds?: Probability
  estimatedEquity?: Probability

  rangeCategories?: string[]
  possibleHands?: string[]
  valueCombos?: number
  bluffCombos?: number
  blockers?: string[]
  outs?: number
  futureStreetPlan?: string
  responseToRaise?: string
  worseHandsThatCall?: string[]
  betterHandsThatFold?: string[]
}
```

- Quick：只有 action 必填。
- Training：rangeStrength、purpose、estimatedPotOdds、estimatedEquity、action 必填。
- Deep：Training 字段 + 深度字段必填；无法精确计数时允许用户填 0 并附说明，不能伪造精度。
- 保存 UI 原始输入和归一化值，便于分析输入误差。

## 6. AI 决策与 Review DTO

```ts
interface DecisionRecord {
  id: string
  handId: HandId
  eventNo: number
  actorId: PlayerId
  actorViewHash: string
  priorJson: ActionPrior
  legalActionsJson: LegalActionSet
  selectedActionJson: PlayerAction
  source: 'MODEL' | 'FALLBACK' | 'SCRIPTED'
  modelProvider: string | null
  modelName: string | null
  temperature: number | null
  promptVersion: string
  profileVersionId: string
  rawOutputRef: string | null
  validationErrorsJson: unknown | null
  latencyMs: number | null
  rngSubseed: string
}

interface ReviewOutput {
  overall: 'REASONABLE' | 'MARGINAL' | 'MISTAKE' | 'MAJOR_MISTAKE'
  math: {
    potOddsCorrect: boolean
    actualPotOdds: Probability | null
    heroEstimate: Probability | null
    explanation: string
  }
  rangeReading: { score: number; mainIssue: string | null }
  betPurpose: { correct: boolean; mainIssue: string | null }
  decision: {
    recommendedAction: 'FOLD'|'CHECK'|'CALL'|'BET'|'RAISE'|'ALL_IN'
    recommendedSizingTo: Chips | null
    confidence: Probability
  }
  analysis: {
    informationAtDecision: string
    math: string
    range: string
    exploit: string
    action: string
    sizing: string
    thinkingLeak: string
  }
  leakTags: LeakTag[]
}
```

review 的 `actualPotOdds` 由程序注入，模型无权改写；若输出冲突，以程序值为准并记录 validation warning。

## 7. 持久化实体

### 7.1 身份、画像与 session

| 表 | 关键字段 | 约束/说明 |
|---|---|---|
| `Player` | id, name, kind, active | name unique；kind = HERO/AI |
| `ProfileVersion` | id, playerId, version, paramsJson, status | unique(playerId, version)；每人最多一个 ACTIVE |
| `OpponentRead` | observerId, subjectId, sessionId, metricsJson | unique(observerId, subjectId, sessionId) |
| `Session` | id, status, settingsJson, seed, startedAt, endedAt | settings 含盲注/人数/rebuy/mode |
| `SessionSeat` | sessionId, seatNo, playerId, initialStack | unique(sessionId, seatNo/playerId) |
| `PlayerSessionState` | sessionId, playerId, stateJson, version | 乐观锁 |
| `Rebuy` | id, sessionId, playerId, handNo, ordinal, amount | 只能发生在 hand 间；ordinal 驱动规则 |

### 7.2 手牌、事件和快照

| 表 | 关键字段 | 约束/说明 |
|---|---|---|
| `Hand` | id, sessionId, handNo, seed, engineVersion, status, buttonSeat, stateHash | unique(sessionId, handNo) |
| `HandParticipant` | handId, playerId, seatNo, startingStack, endingStack, profileVersionId | 一手使用固定画像版本 |
| `HandEvent` | id, handId, seq, type, publicPayloadJson, privatePayloadRef, commandId | unique(handId, seq), unique(commandId) |
| `HandSnapshot` | id, handId, eventSeq, schemaVersion, stateJson, stateHash | unique(handId, eventSeq) |
| `CommandReceipt` | commandId, handId, expectedVersion, resultEventFrom/To | 幂等回执 |
| `AiDecision` | 见 DecisionRecord | unique(handId, eventNo, actorId) |

私有牌可在单机 V1 存数据库受限 JSON；接口层必须隔离。若上线多用户，升级为应用层加密并将 key 放到数据库之外。

### 7.3 训练、复盘和 leak

| 表 | 关键字段 | 说明 |
|---|---|---|
| `HeroDecision` | id, handId, eventNo, thoughtJson, actionJson, legalContextJson | 保存决策时快照，不能事后覆盖 |
| `HandReview` | id, handId, status, reviewJson, reviewerProvider/model, promptVersion, inputHash | 可多次生成；标记 active 版本 |
| `DecisionReview` | reviewId, heroDecisionId, reviewJson | 每个 Hero 决策独立评价 |
| `LeakOccurrence` | id, reviewId, decisionId, tag, street, opponentId, estimatedEvLoss, confidence | Dashboard 的原子事实 |
| `LeakAggregate` | ownerId, tag, window, metricsJson, calculatedAt | 可重建缓存，不是事实源 |

`estimatedEvLoss` V1 可为空；没有可靠 range/equity 模型时不能让 LLM 伪造精确 EV。允许保存区间或低置信度估算：

```ts
interface EvLossEstimate {
  min: number
  max: number
  unit: 'CHIPS' | 'BB'
  confidence: Probability
  method: 'RULE_BASED' | 'MONTE_CARLO' | 'REVIEW_ESTIMATE'
}
```

### 7.4 画像反馈和真实牌例

| 表 | 关键字段 | 说明 |
|---|---|---|
| `ProfileFeedback` | id, handId, decisionId, playerId, sentiment, correctionText, observedActionJson | LIKE_PLAYER / UNLIKE_PLAYER / CORRECTION |
| `ProfileAdjustmentSuggestion` | id, playerId, baseVersionId, patchJson, evidenceJson, status | PENDING/ACCEPTED/REJECTED；不自动发布 |
| `RealHand` | id, source, status, rawText, normalizedJson, validationJson | DRAFT_INVALID/VALIDATED/ARCHIVED |
| `RegressionCase` | id, realHandId, actorId, targetDecisionJson, toleranceJson, active | 校验目标是概率/动作可达性，不要求每次同动作 |
| `RegressionRun` | id, caseId, engineVersion, promptVersion, profileVersionId, resultJson | 比较版本变化 |

## 8. 推荐索引

```text
Hand(sessionId, handNo)
Hand(status, createdAt)
HandEvent(handId, seq)
HeroDecision(handId, eventNo)
AiDecision(handId, eventNo)
LeakOccurrence(tag, createdAt)
LeakOccurrence(opponentId, street, tag)
ProfileFeedback(playerId, createdAt)
RealHand(status, createdAt)
```

SQLite 开启 foreign keys 与 WAL；写操作保持短事务。迁移 PostgreSQL 时保留 ID、枚举字符串、JSON schema version 和唯一约束。

## 9. 版本与删除策略

- `ProfileVersion`、`PromptVersion`、`HandEvent`、已完成 `HeroDecision` 不做硬删除。
- 玩家“删除”改为 inactive；画像版本改为 retired。
- 草稿真实牌例可删除；进入 regression 后改为 archived。
- Review 可重跑，但旧 review 保留，新的记录设为 active。
- JSON 结构都带 `schemaVersion`；读取端提供向前迁移函数。

## 10. 数据校验

保存前至少校验：

- Card 格式与全局唯一性。
- 所有 probability 在 `[0,1]`。
- 筹码均为非负安全整数。
- `pfr <= vpip` 只做 warning，不强制（画像是估计值）；明显不一致需 UI 提示。
- real hand 的 action 顺序、bet-to、stack 与 board 街道合法。
- profile patch 只能触及白名单参数。
- leak tag 来自版本化 taxonomy。
- raw AI output 绝不直接写入权威 state。

