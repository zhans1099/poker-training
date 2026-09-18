# Poker Trainer

固定熟人德州扑克决策训练器的独立 TypeScript 工作区。

## 工作区

- `apps/web`：Next.js Web/BFF 壳。
- `packages/domain`：跨层共享的领域类型。
- `packages/schemas`：API 与 AI 边界的 Zod schema。
- `packages/poker-engine`：无 IO、可 seed、可测试的扑克规则引擎。

## 命令

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Docker Compose 部署

```bash
cp .env.docker.example .env.docker
# 编辑 .env.docker，至少设置数据库密码、AUTH_SECRET、登录账号密码和模型 Key
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

默认只监听 `127.0.0.1:3000`，不会直接暴露到公网。需要从其他设备访问时，建议通过带 HTTPS 的反向代理转发；如确需直接监听局域网，可将 `APP_BIND_ADDRESS` 改为服务器局域网 IP。

首次创建 MySQL 数据卷时会自动导入数据库结构和人物画像种子。已存在的数据卷不会重复初始化。备份数据卷后可使用：

```bash
docker compose --env-file .env.docker down
docker compose --env-file .env.docker up -d
```

站点强制登录，页面和 API 都受签名会话保护；`robots.txt` 与响应头同时禁止搜索引擎收录。只有 Docker 健康检查接口 `/api/health` 无需登录，且仅返回服务是否可用。
