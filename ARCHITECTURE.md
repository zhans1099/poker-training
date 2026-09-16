# 固定熟人德州扑克决策训练器：系统架构

> 状态：V1 架构草案  
> 日期：2026-09-16  
> 范围：P0-P2 的可演进基础；不包含 GTO/CFR/完整 EV Tree

## 1. 架构结论

本项目采用 **TypeScript 全栈模块化单体（modular monolith）**，在当前仓库中新建独立的 `poker-trainer/` 工作区：

- Web：Next.js App Router + React + TypeScript + Tailwind + shadcn/ui。
- API：Next.js Route Handlers/Server Actions，只承担鉴权、DTO 校验、用例编排和流式状态推送。
- 规则：独立的纯 TypeScript `poker-engine` 包；不访问数据库、不调用 LLM、不依赖 UI。
- AI：独立的 `ai-orchestrator` 包；玩家决策与牌后复盘使用不同接口、Prompt、上下文和调用记录。
- 数据：Prisma + SQLite（V1 单机）；通过 Repository 接口隔离，为 PostgreSQL 迁移预留边界。
- 校验：Zod 作为 API、AI 输出、快照和导入数据的运行时 schema。
- 牌型：使用经过验证且支持 5/7 张牌的 evaluator 库，并用黄金用例交叉验证；洗牌、下注、边池仍由本项目实现。

当前 `RuoYi-Vue-master/`（Spring Boot 4）与 `RuoYi-Vue3-master/`（Vue 3 JavaScript）是通用后台基座，且当前均为未纳入 Git 的目录。它们不适合作为 V1 核心，原因是：

1. 领域模型需要前后端共享严格 TypeScript 类型；现有前端不是 TypeScript。
2. 手牌模拟需要无 IO、可 seed、可属性测试的状态机，而不是 CRUD Controller/Mapper 模式。
3. 同时维护 Java 规则引擎、JavaScript UI 和 AI DTO 会增加双份模型与序列化漂移。

因此 V1 **不删除、不改造 RuoYi**。若后续需要多租户、RBAC、运营后台，可让 RuoYi 作为独立管理端，通过稳定 API 访问训练器服务。

## 2. 核心原则与信任边界

### 2.1 单一事实源

`GameState` 是牌局唯一事实源。所有改变必须是：

```text
GameState + Command -> validate -> Event[] -> reduce -> NewGameState
```

- 客户端不能直接提交 pot、stack、board 或 street。
- AI 只能提交意图 `DecisionOutput`，不能提交新状态。
- 数据库只保存事件、关键快照和模型调用记录，不参与规则判断。
- 派生数据（pot、toCall、SPR、pot odds、有效筹码、合法动作）由引擎计算。

### 2.2 数学与 AI 隔离

程序负责：洗牌、发牌、行动顺序、下注合法性、最小加注、all-in、主/边池、摊牌、分池、赔率。

AI 负责：在合法动作与先验概率的边界内，模拟真人偏好；或对 Hero 决策做独立复盘。AI 超时、返回乱码或非法动作时，牌局仍能继续。

### 2.3 隐藏信息最小化

为每个 actor 构造专属 `ActorView`，而不是把完整 `GameState` 传给 AI 或浏览器：

- AI 玩家：自己的 hole cards、公开 board、公开 action history、公开 stack、画像与合法动作。
- Hero 浏览器：Hero hole cards 和所有公开信息。
- Reviewer：仅在手牌结束后按复盘策略获得完整历史与已公开/允许使用的信息。
- 服务端 `GameState` 才持有牌堆和所有 hole cards。

用 DTO 白名单构造视图；禁止通过“先序列化完整状态再删字段”的方式脱敏。

## 3. 逻辑组件

```text
Browser
  -> Web/BFF (Next.js)
      -> Application Services
          -> Poker Engine (deterministic)
          -> AI Orchestrator
              -> Prior Builder (deterministic)
              -> Player Model Provider
              -> Output Guard + Fallback
              -> Review Model Provider (isolated)
          -> Repositories (Prisma)
              -> SQLite / later PostgreSQL
```

### 3.1 Poker Engine

职责：

- `DeckService`：标准 52 张牌、seeded PRNG、Fisher-Yates。
- `TableStateMachine`：建桌、按钮移动、盲注、发牌、各街推进、结束。
- `BettingRules`：行动顺序、check/call/bet/raise/all-in、最小加注和 reopen 规则。
- `PotBuilder`：从不可变 contribution ledger 分层构建主池/边池。
- `ShowdownService`：牌型比较、平分和奇数筹码规则。
- `PokerMath`：pot odds、SPR、effective stack、outs 辅助计算。
- `StateInvariant`：筹码守恒、牌唯一、行动人有效、pot 与贡献一致。

规则引擎禁止依赖 Prisma、HTTP、LLM SDK、系统时间或全局随机数。

### 3.2 Application Services

用例层负责编排，但不复制规则：

- `StartSession`
- `StartHand`
- `SubmitHeroDecision`
- `RunAiTurn`
- `AdvanceUntilHeroOrTerminal`
- `FinalizeHand`
- `RequestHandReview`
- `ImportRealHand`
- `RecordProfileFeedback`
- `BuildLeakReport`

每个改变状态的请求携带 `expectedVersion` 和 `commandId`：前者做乐观锁，后者保证幂等，防止双击或重试造成重复下注。

### 3.3 AI Orchestrator

完整流程见 [AI_DECISION_DESIGN.md](./AI_DECISION_DESIGN.md)。关键边界：

- 确定性 prior 先于 LLM。
- LLM 只能在允许的动作集合内重加权/选择。
- Zod 校验 + 语义合法性校验 + 金额规范化。
- 超时/失败采用 deterministic fallback，并记录原因。
- 玩家决策和 Reviewer 使用不同 provider 实例、系统 Prompt 和 DTO。

### 3.4 Persistence

采用 event log + snapshots 的折中：

- `HandEvent` 是审计与回放依据，追加写。
- `HandSnapshot` 在 Hero 决策点、街转换、手牌结束保存，加速恢复。
- `Hand` 保存摘要、seed、版本及结果。
- 画像、动态状态、AI 调用、训练输入、review、leak 分开存储。

数据库不是事件执行器。加载时由应用层读取最新 snapshot 并重放其后的事件；开发/测试可从初始事件全量重放，验证 hash 一致。

## 4. Poker Game State 状态机

### 4.1 顶层状态

```text
SESSION_IDLE
  -> HAND_SETUP
  -> POSTING_BLINDS
  -> PREFLOP_BETTING
  -> FLOP_DEAL -> FLOP_BETTING
  -> TURN_DEAL -> TURN_BETTING
  -> RIVER_DEAL -> RIVER_BETTING
  -> SHOWDOWN
  -> SETTLEMENT
  -> HAND_COMPLETE
```

任意 betting 状态可在只剩一名未 fold 玩家时直接进入 `SETTLEMENT`。若所有未 fold 玩家均 all-in，则引擎自动补齐 board（按 burn/deal 规则）并进入 `SHOWDOWN`，不再请求行动。

### 4.2 一轮下注结束条件

下注轮结束，当且仅当：

1. 至少一名玩家仍未 fold；
2. 每名仍可行动的玩家已对当前完整加注作出响应；
3. 所有仍可行动玩家的本街投入等于 `currentBet`，或玩家已 all-in；
4. action queue 为空。

不能仅用“所有投入相等”判断，因为一个未构成完整 raise 的短码 all-in 可能要求后位玩家继续响应，却不一定重新开放已行动玩家的 raise 权。

### 4.3 命令、事件与 reducer

核心命令：

```ts
type GameCommand =
  | { type: 'START_HAND'; seed: string }
  | { type: 'ACT'; actorId: string; action: PlayerAction }
  | { type: 'ADVANCE' }
  | { type: 'SETTLE' }
```

核心事件：

```ts
type HandEvent =
  | { type: 'HAND_STARTED'; handNo: number; seedHash: string }
  | { type: 'BUTTON_ASSIGNED'; seat: number }
  | { type: 'BLIND_POSTED'; playerId: string; amount: number; blind: 'SB' | 'BB' }
  | { type: 'CARDS_DEALT'; /* private payload encrypted/segregated */ }
  | { type: 'PLAYER_ACTED'; playerId: string; action: PlayerAction; legalContext: LegalActionSet }
  | { type: 'STREET_ADVANCED'; street: Street; board: Card[] }
  | { type: 'POTS_BUILT'; pots: Pot[] }
  | { type: 'SHOWDOWN_RESOLVED'; awards: PotAward[] }
  | { type: 'HAND_COMPLETED'; stateHash: string }
```

同一个初始配置、seed 和命令序列必须得到相同事件序列与最终 `stateHash`。

### 4.4 下注语义

内部统一将 `amount` 定义为 **行动后本街累计投入（raise-to/bet-to）**，不是增量；UI 可以显示“加到 800”，API 不接受歧义金额。

规则动作与策略语义分层处理：规则引擎只执行 fold/check/call/bet/raise/all-in；`DecisionSpotClassifier` 依据不可变行动历史确定性标注 open raise、3bet、4bet、5bet+、squeeze、limp-reraise、back-raise、check-raise、postflop re-raise、c-bet、delayed c-bet、donk/probe bet 和多街 barrel。客户端和 AI 均不得自行声明这些标签。

其中：

- preflop 首次主动加注为 open raise，后续每次加注依次形成 3bet、4bet、5bet+；盲注不计为一次 bet。
- check-raise 要求同一玩家在同一街先 check，随后面对其他玩家 bet 再 raise。
- squeeze 要求面对一次 open raise 和至少一次 call 后再加注。
- 标签分类不改变合法动作、最小加注或 reopen 规则；它仅供画像 prior、复盘和统计使用。
- 分类器带版本号，同一事件序列和分类器版本必须产生同一 spot 标签。

`LegalActionSet` 至少包含：

```ts
interface LegalActionSet {
  canFold: boolean
  canCheck: boolean
  callAmount: number
  canCall: boolean
  canBet: boolean
  canRaise: boolean
  canAllIn: boolean
  minBetTo: number | null
  minRaiseTo: number | null
  maxTo: number
  raiseRightsOpen: boolean
}
```

规则要点：

- `toCall = max(0, currentBet - player.streetContribution)`。
- call 金额为 `min(toCall, stack)`；不足视为 all-in call。
- 无下注时最小 bet 为 BB（配置可覆盖，但默认遵循 NLHE）。
- 完整 raise 增量不小于上一次完整 bet/raise 增量。
- 短码 all-in 可小于最小 raise，但不一定为已行动玩家重新开放 raise 权。
- `allin` 不是绕过规则的动作；它会被规范化为 fold 之外的 check/call/bet/raise 语义并校验。
- heads-up 时 button 同时为 SB，preflop 先行动、postflop 后行动；虽 V1 只开放 5/6 人，底层仍覆盖该规则。

### 4.5 Side pot 与分池

每次投入只追加到 `totalContribution`。结算时按所有玩家不同的累计投入阈值分层：

```text
layerAmount = (level - previousLevel) * 该层有贡献的玩家数
eligible = 该层有贡献且未 fold 的玩家
```

fold 玩家筹码留在池中但无获奖资格。每个 pot 独立比较 eligible 玩家牌力。平局先整除，奇数筹码按 button 左侧起、顺时针依次发放，并记录 `oddChipPolicy`。

### 4.6 强制不变量

每个事件应用后检查：

- 52 张牌无重复；牌只出现在一个区域。
- `initialTableChips + rebuys = stacks + all contributions already awarded/held`。
- stack、contribution、pot 均为非负整数筹码单位。
- 当前 actor 必须在座、未 fold、未 all-in 且在 action queue 首位。
- board 数量与 street 匹配（0/3/4/5）。
- `currentBet` 等于本街最大 contribution。
- 所有 pot 的总额等于尚未派发的总 contribution。
- hand complete 后所有 pot 已派发，奖励和等于 pot 和。

生产环境遇到不变量失败时，冻结该手并生成诊断记录，不能“猜一个状态”继续。

## 5. Seed、随机性与可复现

- 外部 `simulationSeed` 为字符串；通过稳定哈希派生 128/256-bit PRNG 状态。
- 为 deck、每个 AI 决策、review sampling 使用命名子 seed：`hand:{id}:deck`、`decision:{eventNo}`，避免调用顺序变化污染洗牌。
- Fisher-Yates 使用 rejection sampling 生成无 modulo bias 的索引。
- 保存 `engineVersion`、`rngAlgorithmVersion`、`evaluatorVersion`、`profileVersion`、`promptVersion`、model、temperature。
- LLM 本身可能无法绝对复现，因此保存完整脱敏 input hash、raw output、validated output 和 fallback；牌局状态回放始终使用已经落盘的最终动作，而不是重新调用模型。

## 6. API 与并发模型

V1 推荐关键接口：

```text
POST /api/sessions
POST /api/sessions/:id/hands
GET  /api/hands/:id/view
POST /api/hands/:id/actions
POST /api/hands/:id/advance
POST /api/hands/:id/review
GET  /api/profiles
PATCH /api/profiles/:id
POST /api/hands/:id/profile-feedback
POST /api/real-hands/import
GET  /api/leaks
```

- 所有写请求先做 Zod 校验。
- action 请求使用事务 + hand `version` 乐观锁。
- `commandId` 建唯一索引实现幂等。
- AI turn 在服务端执行；前端轮询或 SSE 接收事件。V1 不必引入 Redis/队列。
- AI 调用超时不持有数据库长事务：先记录 pending intent，调用结束后重新检查 hand version，再提交结果。

## 7. 目录结构

```text
poker-trainer/
├─ apps/
│  └─ web/
│     ├─ app/
│     │  ├─ (trainer)/table/
│     │  ├─ profiles/
│     │  ├─ settings/
│     │  ├─ reviews/[handId]/
│     │  ├─ leaks/
│     │  ├─ real-hands/import/
│     │  └─ api/
│     ├─ components/
│     └─ server/
├─ packages/
│  ├─ poker-engine/
│  │  ├─ src/cards/
│  │  ├─ src/betting/
│  │  ├─ src/pots/
│  │  ├─ src/showdown/
│  │  ├─ src/math/
│  │  └─ test/
│  ├─ domain/
│  ├─ application/
│  ├─ ai-orchestrator/
│  │  ├─ src/player-decision/
│  │  ├─ src/hand-review/
│  │  ├─ src/providers/
│  │  └─ prompts/
│  ├─ schemas/
│  ├─ db/
│  │  ├─ prisma/schema.prisma
│  │  └─ src/repositories/
│  └─ test-fixtures/
├─ docs/
├─ pnpm-workspace.yaml
└─ package.json
```

## 8. MVP 页面与信息架构

### Poker Table

- 圆桌座位、头像、stack、button/SB/BB、状态和当前行动高亮。
- board、pot/side pots、street、Hero cards、effective stack、SPR。
- Hero 合法动作按钮和 bet-to slider；按钮完全由 `LegalActionSet` 驱动。
- Quick 直接行动；Training/Deep 在提交最终动作前完成思考表单。
- action timeline 显示每次行动前后的 pot，而不泄露隐藏手牌。

### Player Profiles

- Z/J/L/H/P 的静态画像、动态状态、对 Hero read 分区显示。
- slider 保存为新 `ProfileVersion`；历史手牌继续引用旧版本。
- Hero 页面维护“各对手眼中的 Hero”，不能只存一个全局 image。

### Training Settings

- 5/6 人、临时缺席者、盲注、起始筹码、rebuy 规则、模式、模型、速度、seed。
- 开始 session 后对会影响复现的配置做版本快照。

### Hand Review

- 按街 timeline、当时可见信息、Hero 原始思考、数学真值、range/exploit/action/sizing 复盘。
- 明确分开“决策质量”和“实际结果”。

### Leak Dashboard

- 次数、估算 EV 损失、趋势、街道、对手、典型手牌。
- 支持样本量提示，避免把少量牌例当稳定 leak。
- 独立展示 3bet opportunity/频率、fold/call/4bet vs 3bet、fold vs 4bet、squeeze、check-raise 及 fold vs check-raise；所有频率使用“发生次数 / 合法机会次数”，不可只除以总手数。
- 每个统计项可以下钻到对应牌例和当时的决策点，区分位置、街道、对手、有效筹码与单挑/多人池。

### Real Hand Import

- 结构化 seat/stack/cards/board/action 编辑器。
- 边录入边用规则引擎校验；允许保存 `DRAFT_INVALID`，只有 `VALIDATED` 才进入回归集。

## 9. 非功能要求

- 正确性优先：引擎语句覆盖 + property-based tests + 真实牌例回归。
- 可观测：每个 command、event、AI call 带 handId/decisionId/correlationId。
- 隐私：日志不记录 API key；未结束牌局的隐藏牌不进入客户端日志或通用 telemetry。
- 容错：AI 失败最多影响“像不像”，不能破坏“对不对”。
- 性能：单手状态很小，V1 无需微服务、Kafka、Redis 或 CQRS 基础设施。

## 10. 已知决策与待确认项

已决策：

- V1 使用独立 TypeScript 应用，不改造 RuoYi。
- 筹码用整数，金额为 bet-to。
- event log + snapshot；SQLite 起步。
- AI 玩家与 reviewer 强隔离。

实现前需产品确认但不阻塞架构：

- 是否烧牌（默认烧牌，且烧牌进入私有 deck zone）。
- 奇数筹码规则（默认 button 左侧顺时针）。
- straddle、run it twice、保险等 V1 均不支持。
- rebuy 仅在手与手之间发生；默认按第 1 次 2000、第 2 次 4000、第 3 次起 6000。
- 牌局口径中的“第一次 rebuy”是否不含初始买入（默认不含）。

