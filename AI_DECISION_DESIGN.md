# 固定熟人德州扑克决策训练器：AI 决策设计

## 1. 目标和非目标

目标是让 Z/J/L/H/P 在长期统计和具体上下文中“像本人”，同时保证游戏永远由确定性规则驱动。

非目标：

- 不求解 Nash/GTO。
- 不让 LLM 计算 pot、赔率、最小加注或分池。
- 不让模型看到别人的隐藏牌。
- 不要求相同 prompt 的远端 LLM 输出绝对可复现。
- 不用牌局结果倒推当时决定一定正确或错误。

## 2. 两条彻底隔离的管线

```text
Player Decision Pipeline
  ActorView -> Feature Extractor -> Prior Builder -> bounded LLM adjust
  -> schema/semantic guard -> legalizer -> action

Hand Review Pipeline
  Decision-time Snapshot + deterministic math + outcome (separate section)
  -> independent reviewer prompt/provider -> review guard -> leak facts
```

隔离要求：

- 不共享 system prompt。
- 不复用 conversation/session memory。
- 使用不同接口：`PlayerDecisionProvider` 与 `HandReviewProvider`。
- reviewer 输入不包含玩家模型的自然语言“理由”；只包含事实、prior/最终动作可用于审计的结构数据，避免替它自洽。
- reviewer 先分析 decision-time 信息，再在单独字段讨论 showdown；overall 不可由结果直接决定。

## 3. Provider 抽象

```ts
interface PlayerDecisionProvider {
  generateDecision(input: PlayerDecisionModelInput): Promise<unknown>
}

interface HandReviewProvider {
  reviewHand(input: HandReviewModelInput): Promise<unknown>
}

interface ModelProviderFactory {
  playerDecision(config: ModelConfig): PlayerDecisionProvider
  handReview(config: ModelConfig): HandReviewProvider
}
```

不要使用一个含两个方法的对象承载隐式共享 history。provider adapter 只处理 SDK 差异、超时、重试和 structured output；业务校验在 orchestrator。

## 4. Player Decision 输入

`ActorView` 由服务端白名单构造：

```ts
interface PlayerDecisionInput {
  decisionId: string
  handId: string
  street: Street
  actor: {
    playerId: string
    holeCards: Card[]
    position: string
    stack: number
    effectiveStack: number
  }
  publicState: {
    board: Card[]
    potBeforeAction: number
    currentBet: number
    spr: number | null
    actionHistory: PublicAction[]
    publicStacks: Record<string, number>
  }
  profile: PlayerProfileParams
  dynamicState: PlayerSessionStateForDecision
  reads: OpponentRead[]
  legalActions: LegalActionSet
  prior: ActionPrior
  rngSubseed: string
  promptVersion: 'player-decision-v1'
}
```

明确排除：deck 顺序、其他 hole cards、未来 board、内部牌力排名结果、其他模型的 chain-of-thought。

牌面/手牌特征（made hand class、draw class、blocker class）由 evaluator/feature extractor 提供结构化标签，避免让 LLM 识别基础牌型时出错；不提供对手真实牌力。

## 5. Step A：确定性 Feature Extractor

程序计算可验证特征：

- position、playersInHand、heads-up/multiway。
- pot、toCall、pot odds、SPR、effective stack（均由引擎给出）。
- 当前手牌类别、overcards、pair tier、draw 类型、组合 draw。
- board texture：paired/monotone/two-tone、连接度、high-card density、动态程度。
- action pressure：首次 bet、面对 raise、3bet pot、all-in 等。
- Hero 是否为 aggressor、下注相对 pot 的 bucket。
- tilt/loss/chasing/read 的离散 bucket。

Feature Extractor 必须纯函数并有单测。模型可获得标签，但不得把标签写回规则状态。

## 6. Step B：Action Probability Prior

### 6.1 输出结构

```ts
type CanonicalAction = 'FOLD'|'CHECK'|'CALL'|'BET_SMALL'|'BET_MEDIUM'|
  'BET_LARGE'|'RAISE_SMALL'|'RAISE_LARGE'|'ALL_IN'

interface ActionPrior {
  probabilities: Partial<Record<CanonicalAction, number>>
  sizingBuckets: {
    BET_SMALL?: number
    BET_MEDIUM?: number
    BET_LARGE?: number
    RAISE_SMALL?: number
    RAISE_LARGE?: number
  } // values are bet-to amounts after clamping to legal range
  features: string[]
  version: string
}
```

先移除不合法动作，再归一化。金额 bucket 由程序根据 pot、current bet、minRaiseTo/maxTo 生成。

### 6.2 建议的 prior 构造

不直接把 VPIP 当具体行动概率。先按 street/decision spot 选基础 logistic score，再叠加画像和上下文：

```text
score(action) = base(spot, action)
              + handStrengthWeight
              + drawWeight
              + profileWeights
              + position/multiway/SPR weights
              + dynamicState weights
              + actor-specific read weights
probabilities = softmax(maskIllegal(scores), temperatureByProfile)
```

示例规则：

- Z 面对可承受 call 且有 draw：`drawChasing` 提高 CALL，`semiBluffFrequency` 提高 RAISE。
- Z tilt 高/大幅落后/连败：只在有一定 equity 或已配置 air-bluff gate 时，提高 large raise/all-in；设硬上限，避免“上头=随机 shove”。
- J 面对 Hero 大尺度：`largeBetBluffReputation` 与 `heroCallFrequency` 提高 bluff-catch CALL；主动 RAISE/ALL_IN 仍由更强 value gate 约束。
- L/P 根据 pot odds、位置和 multiway 更敏感；P 风险温度低于 L。
- Hero 最近连续展示 value：各观察者对 Hero 的 bluff adjustment 按证据与衰减降低。

所有 adjustment 都必须有 cap，并记录 `features`，以便回归和解释。

### 6.3 画像稳定性

- 每个 profile 有 `behaviorTemperature` 与 `priorMaxDelta`。
- 单次 LLM 调整不能让任何动作 logit 偏移超过上限（建议 ±0.8），也不能给原 prior 为 0 的策略外动作加概率。
- 长期回归检查 VPIP/PFR/3bet、call/raise、large bet/all-in 等区间，而不是要求单手固定。

## 7. Step C：受约束的 LLM 调整

模型收到 profile、features、prior、合法动作和有限上下文，输出：

```ts
interface DecisionOutput {
  action: 'fold'|'check'|'call'|'bet'|'raise'|'allin'
  amount: number // bet-to；fold/check 为 0
  confidence: number
  reasoningTags: Array<
    'value'|'bluff'|'semi_bluff'|'draw_chasing'|'pot_control'|
    'protection'|'trap'|'hero_is_bluffy'|'tilt_aggression'|
    'price_sensitive'|'multiway_caution'
  >
  priorAdjustments?: Partial<Record<CanonicalAction, number>> // bounded logit delta
}
```

Prompt 指令必须声明：

1. 只能使用给定信息。
2. 不输出自然语言正文。
3. 不能改变牌局事实。
4. amount 是 bet-to。
5. 必须尊重 legal actions 和范围。
6. 选择应接近 prior，仅允许上下文造成有限调整。

优先使用 provider 的 strict JSON schema；仍必须在本地 Zod 校验。

## 8. Step D：校验、规范化与 fallback

校验分四层：

1. JSON/schema：字段、枚举、数值范围、额外字段策略。
2. 信息安全：输出不得包含/引用未提供的隐藏牌；reasoningTags 必须在白名单。
3. 语义：check 时 toCall 必须为 0；call/raise 权存在；amount 是安全整数。
4. 规则：将动作交给 `BettingRules.validateAction` 做最终判断。

可以安全规范化的情况：

- `amount` 小数：按筹码单位和确定的 rounding policy 取整，再校验。
- raise-to 超过 maxTo：仅当 action 明确为 all-in/raise 且策略允许时 clamp 为 maxTo，并记录修正。
- 模型返回 call 且 amount 不准：忽略其金额，使用引擎精确 call-to。

不可悄悄修复动作类型错误。失败时最多进行 1 次 schema repair（不给更多牌局信息），之后 fallback。

### 8.1 Deterministic fallback

```text
1. 取合法 prior，归一化；
2. 用 decision rngSubseed 加权采样；
3. bucket 金额由引擎计算；
4. 再做一次规则校验；
5. 理论上仍失败则选择最安全合法动作：check > call > fold；
6. 标记 source=FALLBACK、错误、原始输出 hash。
```

“最安全合法动作”只作为 invariant breach 的最后保险，正常 fallback 应保持人物 prior。

### 8.2 超时与重试

- 单次玩家模型调用建议 3-5 秒超时。
- 网络/5xx 最多重试 1 次；validation 错误只做一次受限 repair。
- 使用 `decisionId` 幂等；调用完成后若 hand version 已变化，结果作废，不落为行动。

## 9. Hand Review Pipeline

### 9.1 输入拆分

每个 Hero decision 形成不可变 snapshot：

- 当时可见 hole cards、board、公开 action、pot/stack/position/SPR。
- 对手当时的 profile version 与 Hero read。
- legal actions 和 sizing range。
- Hero 填写的 range、purpose、pot odds、equity、计划及最终动作。
- 程序计算的实际 pot odds；可用时加入 Monte Carlo equity 的方法、假设、样本数和置信区间。
- showdown/result 放在 `outcomeContext`，系统 prompt 要求 decision quality 在读取结果前先定稿。

### 9.2 Review 顺序

Reviewer 必须逐项输出：

1. `informationAtDecision`：只列当时可得信息。
2. `math`：比较 Hero 输入与程序真值。
3. `range`：范围是否随行动收窄，是否忽略人物画像。
4. `exploit`：针对该熟人的偏离是否有证据。
5. `action`：fold/check/call/bet/raise 的逻辑。
6. `sizing`：目的与尺寸是否一致。
7. `thinkingLeak`：思维漏洞与可执行改进。
8. 最后才可用 outcome 做“校准信息”，不可改写前述评价。

### 9.3 Review guard

- Zod 校验结构与 score 0-100。
- actualPotOdds 用程序值强制覆盖。
- recommended sizing 必须在当时合法范围，否则置空并标 validation warning。
- leakTags 必须来自 taxonomy。
- 绝对化措辞（如“肯定”“100%”）只做质量警告，不自动改变结论。
- 若输入不足以给出精确 equity/EV，必须允许 `unknown`/区间，不能虚构点估计。

## 10. Leak Taxonomy 与聚合

V1 taxonomy：

```ts
type LeakTag =
  | 'hero_call_too_wide'
  | 'bluff_too_large'
  | 'value_bet_too_small'
  | 'over_protection'
  | 'under_protection'
  | 'ignore_pot_odds'
  | 'equity_overestimate'
  | 'equity_underestimate'
  | 'ignore_opponent_profile'
  | 'fail_to_update_range'
  | 'call_too_wide_vs_raise'
  | 'bluff_wrong_opponent'
  | 'overplay_one_pair'
  | 'overplay_two_pair'
  | 'fail_to_fold_vs_polarized_range'
  | 'tilt_decision'
  | 'randomize_without_reason'
```

每个 occurrence 带 confidence、street、opponent、spot 和可选 EV loss。Dashboard 同时展示样本量，趋势用最近 N 个机会中的发生率，而不是只看绝对次数。

## 11. Profile Feedback 与学习

用户的“很像/不像/修正”先作为证据保存：

```text
Feedback -> evidence grouping -> suggested bounded patch -> user approval
-> new immutable ProfileVersion -> future hands only
```

- 不直接修改 active version。
- suggestion 必须说明证据数、相反证据、样本区间和参数 patch。
- 单次建议幅度默认不超过 ±0.05；极少样本只建议 tag/备注，不调整数值。
- real hand regression 检查目标动作是否保持合理非零概率及总体分布，不以一次随机输出判失败。

## 12. Prompt 与调用版本化

Prompt 文件建议：

```text
prompts/player-decision/v1/system.md
prompts/player-decision/v1/schema.json
prompts/hand-review/v1/system.md
prompts/hand-review/v1/schema.json
```

每次调用保存：

- promptVersion 与模板内容 hash。
- provider/model/temperature/structured-output mode。
- profileVersion、priorVersion、engineVersion、featureExtractorVersion。
- input hash、raw output（受限存储）、validated output、repair/fallback 信息、latency。

不得保存 provider 的隐式 conversation id 作为关键复现依赖。

## 13. 测试策略

### Prior 单元测试

- Z draw + tilt 比正常无 draw 的 aggressive weight 更高，但不越 cap。
- J 对 Hero river 大注的 call weight 随 bluff reputation 上升。
- J raise/all-in range 比 call range 强。
- P 的高风险动作频率在同 spot 低于 L。
- illegal actions 在调用模型前概率即为 0。

### Contract/chaos 测试

模拟 provider 返回：空文本、Markdown、NaN、未知 action、越界 amount、超时、重复响应、隐藏牌臆测。结果必须是合法 action 或明确 fallback，游戏不崩溃。

### Statistical regression

固定场景运行足够多 seed，验证动作频率落在置信区间；不要断言单次随机动作。保存 V1/V2 profile+prompt 的对比报告。

### Review 测试

- 相同 decision-time 信息但反转 river 结果，overall 不应显著改变。
- pot odds 错误时 review 必须采用程序真值。
- 推荐非法 sizing 必须被 guard 拒绝/置空。
- 玩家 decision reasoning 不应出现在 reviewer 输入中。

