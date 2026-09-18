# 固定熟人德州扑克决策训练器：开发交接文档

更新日期：2026-09-18
项目目录：`D:\workspace\math-training\poker-trainer`

## 1. 当前暂停点

项目已完成规则引擎、MySQL 数据模型、画像机器人、真实 Qwen 玩家决策 Provider、真实手牌 API、桌面/手机牌桌、新建牌局入口和下一手流程。RuoYi 数据源已经接通，并完成真实的“建桌 → 随机换位 → 发牌 → Hero 决策 → AI 自动推进 → 下一手 → 数据库审计”闭环。

本轮已新增单用户强制登录、伪装为普通“内部工作台”的登录页、页面/API 全局鉴权、退出登录、禁止 SEO 收录、健康检查、Dockerfile、Docker Compose 和 Docker 部署配置模板。当前已按用户要求暂停，Git 未提交。

第一次真实 Docker 应用镜像构建成功。构建日志发现 Debian slim 缺少 OpenSSL，随后已把 OpenSSL 固化到共享基础镜像；第二次重建已确认 Prisma 不再出现 OpenSSL 兼容警告，但在 Next.js 下载 Linux SWC 阶段收到用户暂停指令，因此主动中断。恢复后应重新执行最终 Docker build。

当前下一优先级是真实牌例结构化录入、草稿、合法性报告与一键复盘。

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
AI_PLAYER_MAX_LLM_DECISIONS_PER_TURN
AUTH_SECRET
APP_LOGIN_USERNAME
APP_LOGIN_PASSWORD
```

当前脱敏配置结论：

- 数据库：本机 MySQL，数据库名 `poker_trainer`。
- 主 AI Provider：Qwen。
- 备用 Provider：当前也配置成 Qwen。
- 玩家模型：`qwen3.8-flash`。
- 复盘模型：`deepseek-v4-pro`。
- Qwen、DashScope、DeepSeek 的 Key 均已配置。
- Qwen 玩家决策 Provider 已接入业务代码；确定性画像 prior 作为禁用、预算耗尽和异常时的降级路径。
- 单次服务端自动推进默认最多调用 Qwen 2 次，可通过 `AI_PLAYER_MAX_LLM_DECISIONS_PER_TURN` 调整，避免一轮包含大量 AI 行动时等待过久。
- DeepSeek 整手复盘 Provider、版本化 Review API 和牌桌复盘面板已接入，并已使用真实已结束手牌完成远端联调和 MySQL 落库。

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

`packages/database/src/client.ts` 已启用 `allowPublicKeyRetrieval`，解决 MySQL RSA 公钥交换认证问题。另新增 `packages/database/scripts/sync-ruoyi-env.ts`，可通过 `pnpm db:sync-ruoyi-env` 从 RuoYi master 数据源安全同步 `DATABASE_URL`；脚本不会输出连接串或密码。

当前改动已通过全量 TypeScript、ESLint、Prettier、测试和生产构建。

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
- DeepSeek 的对手观察会保存为待确认画像反馈，不会自动污染正式画像。
- 支持接受/忽略画像反馈；接受后保留原有数值参数、追加已确认观察、创建并启用新画像版本，忽略则只保留审计记录。

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
- 手牌完成后显示“继续下一手”面板：
  - 自动沿用结算筹码；
  - 庄位按仍有筹码的玩家顺时针轮转；
  - 默认保持上一手座位；
  - 可在发下一手前选择重新随机换位；
  - 随机换位后庄家身份仍按正常顺序轮转。
- 手牌完成后显示 Deep Review 面板：
  - 明确提示将公开记录与 Hero 决策信息发送给 DeepSeek；
  - 展示复盘摘要、逐决策结论、建议行动和 Leak；
  - 支持重新复盘并保留递增版本；
  - 桌面和 390×844 手机布局均已验证。
- Deep Review 下方显示人物画像建议面板，包含玩家、观察、置信度、接受并应用和忽略操作；桌面和 390×844 手机布局均已验证。
- Leak Dashboard 按每手最新复盘版本聚合 code、街道、次数和严重度，避免重复复盘造成重复计数，并提供原手牌下钻链接；桌面和 390×844 手机布局均已验证。

### 4.5 登录、安全与部署

- `/login` 使用不暴露扑克用途的“内部工作台”界面。
- 使用服务端 HMAC 签名、7 天有效期、HttpOnly、SameSite=Strict Cookie；登录账号、口令和签名密钥均来自环境变量。
- 除登录接口、`robots.txt` 和最小健康检查外，所有页面与 API 都必须登录。
- 未登录访问页面会跳转 `/login?next=...`；未登录访问 API 返回标准 401 JSON。
- 正确登录后可恢复原目标路径；页面提供退出按钮，退出后 Cookie 立即失效。
- HTTP 本地部署不错误设置 Secure Cookie；通过 HTTPS 或 `X-Forwarded-Proto: https` 反向代理时自动启用 Secure。
- Metadata、`robots.txt` 和全站 `X-Robots-Tag` 三层禁止搜索引擎索引、跟踪、缓存和摘要。
- Docker 默认只绑定 `127.0.0.1:3000`，不会直接监听公网网卡。
- `Dockerfile` 使用 Node 22、pnpm 11.8、OpenSSL、非 root `node` 用户运行。
- `docker-compose.yml` 包含 MySQL 8.4、持久卷、首次数据库/种子初始化、服务健康检查和内部网络。
- `.env.docker.example` 提供无密钥的部署配置模板；真实 `.env.docker` 已加入 Git 与 Docker 构建忽略规则。
- 基础 SQL 中误混入的 `Loaded Prisma config...` 命令输出已删除，避免 MySQL 首次初始化失败。

## 5. 关键 API

```text
GET/POST  /api/players
GET/PATCH /api/players/:id
POST      /api/players/:id/profile-versions
POST      /api/players/:id/profile-feedback
PATCH     /api/players/:id/profile-feedback/:feedbackId
POST      /api/opponent-reads

GET/POST  /api/sessions
GET       /api/sessions/:id
POST      /api/sessions/:id/hands

GET       /api/hands/:id
POST      /api/hands/:id/events
POST      /api/hands/:id/next
GET/POST  /api/hands/:id/reviews
GET       /api/hands/:id/profile-feedback
GET       /api/leaks
POST      /api/auth/login
POST      /api/auth/logout
GET       /api/health
```

## 6. 最近一次完整验证

2026-09-18 的完整结果为：

```text
36 项 poker-engine 测试通过
28 项 Web/API 测试通过
pnpm typecheck 通过
pnpm lint 通过
pnpm format:check 通过
pnpm build 通过
```

真实 MySQL 端到端验证结果：

- 创建 1 个六人 Session 和 1 手牌，随机换位结果已持久化；
- 6 条 `hand_participants` 均绑定当时的画像版本；
- Hero 的 1 次决策写入 `hero_decisions`；
- 自动推进产生 8 条 `ai_decisions`；
- 共 10 条 `hand_events`；
- 使用相同 `commandId` 重放时返回 `idempotentReplay: true`，手牌版本未重复增长。
- 生产环境 Prisma 客户端现通过 `globalThis` 单例复用连接池，修复连续 API 请求导致的 `P2039 pool timeout`。
- 并发下一手联调 Session `cmu6j8myg000028ugjrekt26c`：两个同时请求均返回 201 和相同 handId `cmu6j8n96001528ugi30bvt3h`，数据库仅有一条 handNo=2。
- 创建下一手遇到 MySQL 唯一键或可序列化事务冲突时，会在不足 400ms 的有界退避内恢复胜出的下一手。

联调时发现已导入数据库来自较早 SQL 快照，缺少 `hands.state` 与 `hand_participants.profile_version_id`。已在空的手牌表上执行只增列迁移，并同步：

- 修正 `RuoYi-Vue-master/sql/poker_trainer.sql`；
- 新增 `packages/database/sql/20260918_add_hand_state_and_profile_snapshot.sql`。

浏览器验证过：

- 默认演示牌桌；
- 换位置只在点击时发生，点击之间保持不变；
- 思考区展开与行动记录；
- `/?handId=missing-hand` 的明确错误状态；
- `/new` 的 5/6 人切换和随机换位选择；
- 390×844 手机布局；
- 相关页面控制台无错误。
- 未登录访问 `/` 自动跳转到不暴露扑克用途的登录页；
- 错误口令显示统一错误，不泄露账号是否存在；
- 正确口令进入真实牌桌，登录后受保护 API 返回 200；
- 退出后再次访问 `/` 重新被拦截；
- 未登录 API 返回 401，`/api/health` 返回 200；
- 登录页桌面和 390×844 手机布局无横向溢出，控制台无错误；
- `robots.txt` 返回 `Disallow: /`，页面响应包含 `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex`。

Docker 验证状态：

- `docker compose --env-file .env.docker.example config --quiet` 通过；
- 第一版应用镜像 `poker-trainer-app:latest` 已真实构建成功；
- OpenSSL 修复后的第二次构建中，Prisma 已不再报告 OpenSSL 警告；
- 第二次构建在 Next.js 下载 Linux SWC 时因用户要求暂停而主动中断，不能把它记录为最终构建通过；
- 尚未执行完整的 `docker compose up`，也尚未验证全新 MySQL 数据卷自动导入和容器间健康检查。

Qwen 真实联调结果：

- 独立结构化输出冒烟测试成功，使用 `qwen3.8-flash` 返回合法动作并记录 token 与延迟；
- 真实业务手牌验证了 Qwen 决策、异常回退和 `ai_decisions` 审计落库；
- 开启每轮 2 次远端调用预算后，一次下一手创建约 6.2 秒，产生 2 次 Qwen 决策和 2 次 prior 决策；
- 请求内容检查确认未携带其他玩家私牌、deck 或 seed。

## 7. 恢复开发的第一组任务

1. 重新执行 `docker compose --env-file .env.docker.example build app`，确认 OpenSSL 修复后的最终镜像完整构建成功。
2. 使用专门的临时 `.env.docker` 执行完整 `docker compose up -d`，验证空 MySQL 数据卷初始化、6 名种子玩家、健康检查、登录和一手牌流程；验收后只清理本轮创建的测试容器/卷。
3. 补充生产部署说明，包括 HTTPS 反向代理、数据库备份/恢复和升级步骤。
4. 再继续真实牌例结构化录入、草稿、合法性报告与一键复盘。

## 8. LLM 接入状态与下一步

Qwen 玩家决策已通过 OpenAI-compatible HTTP 接口接入，当前链路为：

```text
PlayerDecisionProvider
  -> Qwen OpenAI-compatible adapter
  -> JSON Schema + Zod output validation
  -> poker engine legal-action validation
  -> timeout / malformed output / illegal action guard
  -> deterministic prior fallback
```

必须遵守：

- Provider 只能收到 actor view，不得收到其他玩家 hole cards、未来 board 或完整 deck。
- 输出先过 Zod structured schema，再过语义校验和规则引擎合法动作校验。
- 超时、HTTP 错误、解析失败、非法动作均回退 prior，不能卡死手牌。
- `ai_decisions` 记录 provider、model、promptVersion、profileVersion、输入视图、输出、校验、延迟和 token；不要记录 API Key。
- 每次决策已将 provider、model、source、promptVersion、validation、latency 和 token 写入 `ai_decisions`。
- 当前环境主 Provider 是 Qwen；复盘模型配置为 DeepSeek。模型与地址均保持配置驱动。
- DeepSeek adapter 使用独立的整手复盘链路和 `json_object` 输出，未混入实时玩家决策链路。
- `POST /api/hands/:id/reviews` 只接受已结束手牌，传入公开事件、Hero 当时视图/思考/动作；校验通过后按递增版本写入 `hand_reviews`。
- `deepseek-v4-pro` 默认开启高强度思考，容易在 JSON 模式下耗尽最终输出；复盘 Provider 显式使用 `thinking.type=disabled`，默认超时 90 秒。
- 真实手牌 `cmu6alkav002ub8uga0f934jv` 已完成多轮提示词校准；第 5 版为当前有效结果，延迟 9063ms，已正确使用 Hero 大盲位及 JL/JJ/胖子/HG 姓名，不再臆造对手位置。历史版本仍保留在 `hand_reviews`。

## 9. 仍未完成的产品功能

按建议优先级：

1. 真实牌例结构化录入、草稿、合法性报告与一键复盘。
2. 复盘版本切换与历史差异 UI。
3. 画像建议编辑结构化参数的高级模式。
4. 长周期连续多手、5/6 人各 1000 手模拟、10k 随机合法命令测试。

部署收口仍缺：

1. OpenSSL 修复后的最终 Docker 镜像完整重建。
2. 全新 Compose 栈（空数据卷）的端到端启动验证。
3. HTTPS 反向代理范例。
4. MySQL 自动备份、恢复和版本升级文档。

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

Docker 部署与恢复验收：

```powershell
Copy-Item .env.docker.example .env.docker
# 手工填写强密码、AUTH_SECRET、登录账号密码和模型 Key
docker compose --env-file .env.docker config
docker compose --env-file .env.docker build app
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 200 app mysql
```

注意：不要把 `.env.docker` 提交到 Git。测试全新数据库初始化时必须使用明确命名的临时 Compose project/volume，确认目标后再清理，禁止误删现有 `poker_mysql_data`。

数据库命令：

```powershell
pnpm db:generate
pnpm db:push
pnpm db:seed
```

在 RSA 认证问题解决且确认目标数据库状态前，不要直接运行写数据库命令。
