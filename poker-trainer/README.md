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
