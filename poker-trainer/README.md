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

## 编译后上传并以 Docker Compose 部署

服务器必须预先存在 `node:22-bookworm` 和 `mysql:8.4` 两个镜像。部署过程不会构建、上传或拉取镜像；Node 容器直接挂载本地编译好的 Next.js standalone 产物。

先在本机准备配置：

```powershell
Copy-Item .env.docker.example .env.docker
# 编辑 .env.docker，填写数据库密码、AUTH_SECRET、登录账号密码和模型 Key
```

然后执行一条命令完成本地编译、打包、上传、远程解压和 Compose 启动：

```powershell
.\scripts\package-and-deploy.ps1 -Server root@服务器IP
```

服务器部署目录固定为 `/home/poker-trainer/`，每次覆盖上一版，只保留当前版本，不创建历史版本目录。本地部署包名固定为 `releases/poker-trainer-latest.tar.gz`。使用 `-NoStart` 时替换文件后不启动；使用 `-PackageOnly` 可只生成本地部署包，`-SkipBuild` 可复用已有 standalone 产物。服务器启动命令固定使用 `--pull never --no-build`，不会做多余动作；已有 MySQL Docker 数据卷会保留。

默认只监听 `127.0.0.1:3000`，不会直接暴露到公网。需要从其他设备访问时，建议通过带 HTTPS 的反向代理转发；如确需直接监听局域网，可将 `APP_BIND_ADDRESS` 改为服务器局域网 IP。

首次创建 MySQL 数据卷时会自动导入数据库结构和人物画像种子。已存在的数据卷不会重复初始化。备份数据卷后可使用：

站点强制登录，页面和 API 都受签名会话保护；`robots.txt` 与响应头同时禁止搜索引擎收录。只有 Docker 健康检查接口 `/api/health` 无需登录，且仅返回服务是否可用。
