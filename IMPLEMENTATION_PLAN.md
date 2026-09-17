# 固定熟人德州扑克决策训练器：实施计划

## 1. 交付策略

按“正确规则 -> 可玩闭环 -> 受控 AI -> 训练复盘 -> 长期学习”推进。每阶段都有独立验收门；上一阶段不通过，不向下叠功能。

本轮只交付设计文档，不创建应用代码。目标目录为 `poker-trainer/`，现有两个 RuoYi 目录保持不变。

## 2. 阶段 0：工程骨架与契约

交付：

- pnpm workspace、Next.js TypeScript 应用与 packages 骨架。
- ESLint、Prettier、Vitest、Playwright、TypeScript strict。
- Zod DTO 包、领域基础类型、统一错误码。
- Prisma + MySQL 8、首次 migration、Repository 接口。
- CI：install、lint、typecheck、unit test、build。
- ADR：技术栈、金额语义 bet-to、seed/RNG、event log、RuoYi 隔离。

验收：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

全部通过；禁止 `any` 逃逸关键领域类型。

## 3. 阶段 1（P0-A）：纯 Poker Rule Engine

### 1.1 Cards/RNG

- Card parser/formatter、52 张 deck。
- 稳定 seed 派生、命名子 seed、Fisher-Yates。
- 同 seed 同 deck；大量 seed 下无重复/遗漏。

### 1.2 Table 与发牌

- 5/6 人 seating、临时 sitting out、button/SB/BB 轮转。
- 盲注不足时 all-in posting。
- hole cards、burn、flop/turn/river。

### 1.3 Betting round

- action queue、fold/check/call/bet/raise/all-in。
- bet-to 金额、min raise、短码 all-in、raise rights reopen。
- preflop/postflop 顺序、街结束和全员 all-in 自动推进。
- 基于行动历史的 `DecisionSpotClassifier`：open raise、3bet、4bet、5bet+、squeeze、limp-reraise、back-raise、check-raise、postflop re-raise、c-bet/delayed c-bet、donk/probe 与多街 barrel。
- spot 标签只做派生语义，不参与或绕过底层合法动作校验。

### 1.4 Pot/showdown

- contribution ledger、main/side pots、folded dead money。
- 接入 evaluator adapter。
- tie/split/odd chip，多个 side pot 独立 eligible。
- pot odds、SPR、effective stack。

### 1.5 测试门

- 单元测试覆盖每条规则。
- property-based：筹码守恒、牌唯一、state deterministic、pot conservation。
- 黄金用例：至少 30 个复杂下注/边池/平分案例。
- spot 分类黄金用例覆盖位置变化、多人 call、短码 all-in/reopen、跨街重置以及 check-raise 正反例。
- evaluator 用已知牌型全集边界与独立 fixtures 校验。
- fuzz 随机合法命令至少运行 10k 手牌无 invariant failure。

阶段验收：从 seed 和命令日志可精确重放 state hash；非法命令只返回领域错误，不部分修改状态。

## 4. 阶段 2（P0-B）：本地可玩闭环

交付：

- Session/Hand/Events/Snapshot 持久化。
- 5/6 人配置、初始 stack 与 rebuy 规则。
- 最小 Poker Table 页面：座位、stack、board、pot、Hero cards、timeline。
- Hero Quick Mode，按钮由 `LegalActionSet` 生成。
- 无 LLM 的 scripted/prior bot，让一手可从 preflop 走到 settlement。
- optimistic locking、commandId 幂等、断线恢复。

验收场景：

1. 5 人和 6 人各连续完成 1000 手模拟。
2. Hero fold/check/call/min raise/custom raise/all-in 全覆盖。
3. 多人 all-in 生成至少两个 side pot 并正确派奖。
4. 页面刷新恢复同一行动点，不重复扣筹码。
5. 篡改 pot/stack/非法 amount 的请求被拒绝。

## 5. 阶段 3（P0-C）：画像与受控 AI 玩家

交付：

- 数据库驱动的玩家 CRUD/启停与画像版本管理；规则和 UI 不硬编码玩家名单。
- Z/J/L/H/P 仅作为初始 `Player` 与 `ProfileVersion` seed 数据，后续可直接新增熟人角色。
- 动态 `PlayerSessionState` 与 per-opponent Hero read。
- Feature Extractor、Prior Builder V1、sizing buckets。
- 画像与 prior 覆盖 3bet/4bet、fold/call/4bet vs 3bet、squeeze、分街 check-raise、fold vs check-raise，并区分 value/bluff/semi-bluff gate。
- `PlayerDecisionProvider` adapter（先 fake，再接首个真实 provider）。
- structured output、Zod/semantic/rule guard、timeout、fallback。
- AI 调用审计和 prompt/profile/version 保存。

验收：

- 新增一个非预置玩家后，无需改代码即可入座、加载画像并由 AI 行动；停用玩家不能加入新 session，但历史记录仍可查询。
- provider 返回任意异常都不会使 hand 崩溃或停死。
- AI 永远看不到其他 hole cards/未来 board（DTO snapshot test）。
- 10k 场景统计回归落在各画像预设区间。
- Z tilt、J vs Hero large bet、L/P price sensitivity 的定向测试通过。
- 3bet/4bet/check-raise 的位置、有效筹码、对手和多人池定向测试通过；非法或 raise 权未开放的策略权重必须为 0。
- 同 seed 回放使用已保存动作得到相同最终状态。

## 6. 阶段 4（P1-A）：Training / Deep Mode

交付：

- Quick/Training/Deep 模式切换。
- Training 必填 range strength、purpose、pot odds、equity。
- Deep 增加 range category、牌型、combo、blocker、outs、future plan、vs raise 计划等。
- Hero 决策时不可变 thought snapshot。
- 程序计算 pot odds，并在行动前按设置隐藏答案。

验收：

- 各模式的 schema 条件必填正确。
- Hero 输入不影响规则计算和合法动作。
- 行动后可以精确还原“当时看见什么、填了什么、最终做了什么”。

## 7. 阶段 5（P1-B）：独立 Hand Review

交付：

- 独立 `HandReviewProvider`、`hand-review-v1` Prompt。
- decision-time 输入构造、结果隔离、程序数学真值。
- Review guard、每个 Hero decision 的结构化评价。
- Hand Review timeline 页面。
- review 重跑与版本历史。

验收：

- 结果反转测试：牌局输赢改变不应改变核心 decision grade。
- pot odds 与 legal sizing 由程序覆盖/校验。
- Reviewer 不接收 player AI 的自然语言 reasoning。
- AI review 失败不影响已完成 hand；UI 可重试。

## 8. 阶段 6（P2）：Leak、反馈与真实牌例

### Leak Dashboard

- taxonomy、occurrence、聚合任务。
- 次数/机会率、趋势、街道、对手、典型牌例。
- 3bet opportunity、fold/call/4bet vs 3bet、fold vs 4bet、squeeze、check-raise、fold vs check-raise 均以合法机会数为分母，并可下钻到对应牌例。
- EV loss 无可靠方法时显示“未估算”，不输出假精度。

### Profile Feedback

- “很像/不像/文本修正”。
- 建议 patch、证据列表、接受/拒绝。
- 接受后创建新版本，只影响未来手牌。

### Real Hand Import

- seat/stack/cards/board/actions/showdown 结构化录入。
- 实时合法性验证、草稿保存、导入报告。
- 一键转 review 和 regression case。
- 回归目标支持“动作概率达到阈值/分布接近”，而非单次输出相等。

验收：

- 示例 `Hero 56 / flop 456 / Z bet 200 / Hero raise 800 / ...` 可被明确记录；若缺少盲注、位置、preflop、有效 stack 等，系统标注缺失假设，不伪装成完整合法 hand。
- 未确认的 profile suggestion 不改变 active profile。
- Dashboard 聚合可从 occurrence 全量重建。

## 9. 阶段 7（P3）：增强项

进入条件：至少积累足够真实反馈和复盘样本。

- 基于反馈的 bounded profile suggestions。
- equity Monte Carlo（明确对手 range 假设、样本数、置信区间）。
- session 级训练推荐与间隔复习。
- 账号/多设备同步、MySQL 读写与归档策略优化。
- prompt/profile A/B 与统计显著性报告。

仍不进入 CFR/Deep CFR/multiplayer solver。

## 10. 测试矩阵

| 层 | 工具/方法 | 重点 |
|---|---|---|
| Domain unit | Vitest | 单条规则与数学函数 |
| Property | fast-check | 守恒、唯一性、determinism |
| Golden fixtures | JSON fixtures | side pot、min raise、odd chip、真实牌例 |
| Repository | 独立 MySQL 测试库 | 事务、唯一约束、重放 |
| API contract | Route handler tests | Zod、鉴权、幂等、乐观锁 |
| AI contract | fake/chaos provider | malformed/timeout/illegal/fallback |
| Statistical | seeded batch | 人物画像长期频率 |
| UI component | Testing Library | legal actions、训练表单 |
| E2E | Playwright | 一整手、刷新恢复、review |
| Security | DTO snapshot/log scan | 隐藏牌/API key 泄漏 |

每个 bug，尤其是真实牌例发现的规则 bug，都先添加失败的 regression fixture，再修复。

## 11. 每阶段 Definition of Done

一项工作只有同时满足以下条件才完成：

- 验收行为已实现，未把非本阶段需求偷偷扩入。
- lint、TypeScript、unit/integration tests、生产 build 全绿。
- 新规则有测试；新 API 有 Zod schema；新 AI 输出有 fallback 测试。
- GameState invariants 在测试与开发环境逐事件检查。
- 没有把隐藏牌暴露给错误 actor。
- migration 可从空库执行；fixture 可重复 seed。
- 关键设计变化同步更新四份文档/ADR。
- 手工完成至少一个 happy path 和一个 failure path。

## 12. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| NLHE 短码 all-in/reopen 实现错误 | 核心规则失真 | 独立 betting module、黄金用例、property tests |
| LLM 偷看隐藏信息 | 模拟不可信 | ActorView 白名单、DTO snapshot/security tests |
| AI 输出不合法或超时 | 牌局停死 | strict schema、guard、deterministic fallback |
| 画像参数与行为脱节 | “不像本人” | prior 可解释 features、统计回归、用户反馈版本化 |
| Reviewer 结果导向 | 错误训练 | decision snapshot 优先、outcome 隔离、反转测试 |
| MySQL 并发写入与事件表增长 | 回放和报表变慢 | 短事务、组合索引、游标分页和事件归档 |
| 过早做复杂 solver | 延迟验证产品价值 | P0-P3 scope gate，先验证熟人 exploit 训练闭环 |
| 现有 RuoYi 与新应用职责混乱 | 重复模型/维护成本 | V1 目录与部署隔离；只通过 API 集成 |

## 13. 建议首个开发迭代

首个实现迭代只做阶段 0 与阶段 1.1-1.3：

1. 创建 TypeScript workspace 和 CI 基线。
2. 固化 Card/Chips/Action/GameState schema。
3. 实现 seeded deck 与状态 reducer。
4. 实现 betting legal action，包括短码 all-in/reopen。
5. 用黄金与属性测试证明规则正确。

首个迭代不接数据库 UI 和 LLM。先把最难返工、也最容易被表面 Demo 掩盖的下注状态机做扎实，再向上搭建产品闭环。
