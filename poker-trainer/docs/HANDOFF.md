# 固定熟人德州扑克决策训练器：开发交接文档

更新日期：2026-09-17  
项目目录：`D:\workspace\math-training\poker-trainer`

## 1. 当前暂停点

项目已完成规则引擎、MySQL 数据模型、基础画像机器人、真实手牌 API、桌面/手机牌桌和新建牌局入口。当前暂停在“接通用户已配置的 MySQL 并执行真实端到端验证”这一步。

最后一次只读数据库查询已经读到了根目录 `.env`，但连接失败。根因不是账号缺失，而是 MySQL 账号使用需要 RSA 公钥交换的认证方式，`@prisma/adapter-mariadb` 当前配置没有启用公钥获取：

```text
RSA public key is not available client side.
Either set cachingRsaPublicKey, or enable allowPublicKeyRetrieval.
```

当前 `packages/database/src/client.ts` 会把 `DATABASE_URL` 解析成 host、port、user、password、database 后传给 `PrismaMariaDb`，因此 URL 中的其他连接参数不会自动透传。这是恢复开发时要先处理的第一个问题。

## 2. 安全与配置约束

- `poker-trainer/.env` 已存在，且被仓库根 `.gitignore` 忽略。
- 不要在命令输出、日志、测试快照、文档或提交记录中打印数据库密码与 API Key。
- 不要复制密钥到 `apps/web/.env`、源码或测试 fixture。
- `RuoYi-Vue-master/ruoyi-admin/src/main/resources/application-druid.yml` 含数据库配置，当前已被修改；不要覆盖或回退用户配置。
- `.env` 中检测到两个 `DEEPSEEK_API_KEY` 定义。恢复开发时应仅保留一个有效定义，但不得在日志中显示值。

已确认存在的配置键：

```text
DATABASE_URL
AI_PROVIDER
AI_PLAYER_MODEL
AI_REVIEW_MODEL
DASHSCOPE_API_KEY
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
QWEN_API_KEY
QWEN_BASE_URL
QWEN_MODEL
LLM_PRIMARY_PROVIDER
LLM_FALLBACK_PROVIDER
```

当前脱敏配置结论：

- 数据库：本机 MySQL，数据库名 `poker_trainer`。
- 主 AI Provider：Qwen。
- 备用 Provider：当前也配置成 Qwen。
- 玩家模型：`qwen3.8-flash`。
- 复盘模型：`deepseek-v4-pro`。
- Qwen、DashScope、DeepSeek 的 Key 均已配置。
- 真实 LLM Provider 尚未接入业务代码，目前 AI 玩家仍使用确定性的画像 prior。

## 3. 环境加载改动

为让 monorepo 子项目统一读取根目录 `.env`，已新增：

- `packages/database/src/environment.ts`
- `packages/database/prisma.config.ts` 调用 `loadWorkspaceEnvironment()`。
- `packages/database/src/client.ts` 调用 `loadWorkspaceEnvironment()`。
- `apps/web/next.config.ts` 调用 `loadWorkspaceEnvironment()`。

加载器只寻找已有 `.env`，不复制配置，也不会把密钥写入源码。候选位置覆盖：

- 从 `poker-trainer` 根目录运行；
- 从 `apps/web` 或 `packages/database` 运行；
- 从上层工作区运行。

这些最新改动已通过数据库包和 Web 包 TypeScript 检查，以及定向 ESLint/Prettier 检查；数据库只读查询因 RSA 认证问题失败后即暂停。修复认证后需要重新执行全量测试和生产构建。

## 4. 已实现功能

### 4.1 工程与数据层

- pnpm TypeScript workspace。
- Next.js Web/BFF。
- Prisma 7 + MySQL 数据模型。
- 数据库存储玩家、画像版本、Session、Hand、参与者、事件、Hero 决策、AI 决策、复盘、Leak、对手读牌与画像反馈。
- 可直接导入的 SQL：
  - `packages/database/sql/poker_trainer_schema.sql`
  - `packages/database/sql/poker_trainer_seed.sql`
  - `RuoYi-Vue-master/sql/poker_trainer.sql`
- 玩家、画像版本、反馈、对手 read、Session、Hand、事件 API。
- 乐观锁 `expectedVersion` 与 `commandId` 幂等。
- Hand 状态和行动日志持久化。

### 4.2 扑克规则引擎

- Seeded deck、发牌、盲注、下注轮。
- fold/check/call/bet/raise/all-in。
- bet-to 金额语义、最小加注、短码 all-in 与 reopen rights。
- 翻前/翻后顺序和多街推进。
- 牌型计算、摊牌、平分与 odd chip。
- 多人 all-in 主池/边池。
- 两人 all-in 时默认发两次剩余公共牌。
- 决策场景分类和画像 prior bot。
- 随机换位使用服务端 seed，结果写入 `HAND_STARTED` 和 `HandParticipant.seatNo`。

### 4.3 人物画像

- 数据库 seed 包含 Hero、23、JL、HG、胖子、JJ。
- 画像已按用户校准内容更新，详见 `docs/personas-v1.md`。
- 画像版本绑定到每一手牌，后续修改只影响未来手牌。
- 支持画像反馈和新版本 API。

### 4.4 前端

- 桌面横向牌桌和手机竖向牌桌。
- 玩家姓名强化显示。
- 思考区默认折叠范围、行动目的、底池赔率、胜率；点击后展开对比。
- Quick / Training / Deep 思考数据 schema 已建立；当前 UI 完成 Quick 与 Training。
- 行动按钮由服务端 `LegalActionSet` 驱动。
- 访问 `/?handId=<id>` 可恢复真实手牌视图。
- Hero 始终显示在底部，其他玩家保持真实相对座次。
- Hero 行动和思考快照提交到事件 API，服务器继续自动推进画像机器人。
- 手牌事件经过公开字段白名单，私牌、deck、seed 和内部画像推理不会暴露给 Hero API。
- `/new` 新建牌局页面：
  - 5/6 人桌；
  - 选择数据库玩家；
  - 设置盲注与初始筹码；
  - 固定位置或随机换位；
  - 创建 Session 和第一手牌后进入真实牌桌。
- 数据库未配置时显示中文错误并禁用发牌。

## 5. 关键 API

```text
GET/POST  /api/players
GET/PATCH /api/players/:id
POST      /api/players/:id/profile-versions
POST      /api/players/:id/profile-feedback
POST      /api/opponent-reads

GET/POST  /api/sessions
GET       /api/sessions/:id
POST      /api/sessions/:id/hands

GET       /api/hands/:id
POST      /api/hands/:id/events
```

## 6. 最近一次完整验证

在环境加载改动之前，最近一次完整结果为：

```text
36 项 poker-engine 测试通过
9 项 Web/API 测试通过
pnpm typecheck 通过
pnpm lint 通过
pnpm format:check 通过
pnpm build 通过
```

浏览器验证过：

- 默认演示牌桌；
- 换位置只在点击时发生，点击之间保持不变；
- 思考区展开与行动记录；
- `/?handId=missing-hand` 的明确错误状态；
- `/new` 的 5/6 人切换和随机换位选择；
- 390×844 手机布局；
- 相关页面控制台无错误。

## 7. 恢复开发的第一组任务

### 7.1 修复 MySQL RSA 认证

优先研究 `@prisma/adapter-mariadb` 使用的 `mariadb` PoolConfig。建议按以下顺序尝试，且每次只输出连接成功/失败，不输出连接串：

1. 在 `PrismaMariaDb` 的 PoolConfig 中显式加入 `allowPublicKeyRetrieval: true`（先用 TypeScript 验证该字段是否被当前 mariadb 类型支持）。
2. 如果当前驱动要求缓存 RSA key，则按驱动文档配置 `cachingRsaPublicKey`。
3. 也可验证 `new PrismaMariaDb(connectionUrl)` 是否能完整保留 URL 查询参数，但必须确认其 TLS/认证行为。
4. 不建议为了绕过客户端问题而降低 MySQL 用户认证安全级别，除非用户明确决定。

只读连接验证命令可使用 Repository，但必须包在 async IIFE 中，因为 `tsx -e` 当前以 CJS 输出，不支持 top-level await。

### 7.2 检查现有数据库状态

连接成功后先只读检查：

- `players` 表是否存在；
- 当前表数量；
- 玩家 code 是否已包含 `hero/23/jl/hg/p/jj`；
- 不要直接执行可能删除列或表的 schema 同步。

若数据库为空：

```powershell
pnpm db:push
pnpm db:seed
```

或由用户导入已生成 SQL。若已有表，先比较 schema，再决定是否执行 `db:push`。

### 7.3 执行真实端到端验证

1. 启动：`pnpm dev`。
2. 打开 `/new`。
3. 选择 Hero 与 5 名对手。
4. 勾选随机换位，创建牌局。
5. 确认跳转到 `/?handId=<id>`。
6. 完成至少一个 Hero 行动。
7. 刷新页面，确认版本、筹码、board、timeline 不回退且不重复扣筹码。
8. 数据库检查 `training_sessions`、`hands`、`hand_events`、`hero_decisions`、`ai_decisions`。
9. 使用同一 `commandId` 重放请求，确认幂等。

## 8. LLM 接入状态与下一步

配置已存在，但代码尚无真实 Qwen/DeepSeek HTTP Provider。建议下一步实现统一接口：

```text
PlayerDecisionProvider
  -> Qwen OpenAI-compatible adapter
  -> DeepSeek OpenAI-compatible adapter
  -> timeout / malformed output / illegal action guard
  -> deterministic prior fallback
```

必须遵守：

- Provider 只能收到 actor view，不得收到其他玩家 hole cards、未来 board 或完整 deck。
- 输出先过 Zod structured schema，再过语义校验和规则引擎合法动作校验。
- 超时、HTTP 错误、解析失败、非法动作均回退 prior，不能卡死手牌。
- `ai_decisions` 记录 provider、model、promptVersion、profileVersion、输入视图、输出、校验、延迟和 token；不要记录 API Key。
- 当前环境主 Provider 是 Qwen；复盘模型配置为 DeepSeek。应保持配置驱动，不在源码硬编码模型名。

## 9. 仍未完成的产品功能

按建议优先级：

1. MySQL 真实端到端闭环与恢复测试。
2. 一手完成后的“下一手”按钮、庄位轮转、沿用结算后筹码及可选再次随机换位。
3. Qwen/DeepSeek 真实 Provider、超时降级和审计。
4. Deep 模式完整 UI。
5. 独立 Hand Review、重跑和版本历史。
6. Leak Dashboard 与牌例下钻。
7. 真实牌例结构化录入、草稿、合法性报告与一键复盘。
8. 画像反馈接受/拒绝 UI。
9. 5/6 人各 1000 手模拟、10k 随机合法命令、并发与断线恢复测试。

## 10. Git 工作区注意事项

- 当前工作区不是干净状态。
- `poker-trainer` 大量新文件已经进入暂存区。
- 最新环境加载文件 `packages/database/src/environment.ts` 仍为未跟踪文件。
- `apps/web/next.config.ts`、`packages/database/prisma.config.ts`、`packages/database/src/client.ts` 显示为 `AM`，表示已暂存版本之后又有未暂存改动。
- 根目录设计文档、RuoYi 数据库配置和 SQL 也有用户/项目改动。
- 不要执行 `git reset --hard`、`git checkout --` 或覆盖式清理。
- 提交前先逐项检查 staged 与 unstaged diff，尤其不要把 `.env` 或任何密钥加入 Git。

## 11. 常用命令

```powershell
cd D:\workspace\math-training\poker-trainer
pnpm install --offline
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm dev
```

数据库命令：

```powershell
pnpm db:generate
pnpm db:push
pnpm db:seed
```

在 RSA 认证问题解决且确认目标数据库状态前，不要直接运行写数据库命令。
