# 个人工作台

一个面向个人、PC 与 Android 浏览器共用的响应式 Web/PWA 工作台。首版已经实现工作台主体、固定 `owner` 账户登录和“倒计时”参考功能；后续功能通过固定注册点接入，不需要重写工作台壳。

## 当前能力

- PC 左侧导航与 Android 底部导航，两套布局共享同一套路由、数据和业务逻辑。
- 总览页聚合当前关注、未来时间轨道、功能摘要和最近内容。
- 功能汇总、固定常用功能、全局搜索、快速创建、通知和设置页。
- 只有一个固定 `owner` 账户，不提供注册、多用户、角色或租户功能。
- 可选长期登录：空闲期限 180 天、绝对期限 365 天；服务端会轮换 Session，前端不保存认证令牌。
- 倒计时完整纵向切片：创建、编辑、完成、恢复、归档，并接入总览、搜索、快速创建和通知。
- 单一工作区根目录、PostgreSQL 逻辑备份、SHA-256 校验和，以及恢复到新空目录和新空数据库的命令。
- PWA 静态资源离线缓存；认证 API 响应不会进入 Service Worker 缓存。

## 技术结构

```text
apps/web/                 React + Vite + TypeScript 响应式 PWA
apps/api/                 Fastify 模块化单体 API 与管理 CLI
packages/client-sdk/      前后端共享 DTO、API 客户端和 OpenAPI 类型
contracts/                由后端生成的 OpenAPI 契约
infra/                    Docker、Compose 与 Caddy 同源 HTTPS 配置
docs/                     架构、主体设计和操作文档
```

业务功能保留在各自的前后端目录中。工作台只通过三个固定注册点发现功能：

- `apps/web/src/app/feature-catalog.ts`
- `apps/web/src/app/feature-routes.tsx`
- `apps/api/src/app/feature-registry.ts`

倒计时是首个参考实现，具体接入方法见[新增功能开发指南](docs/03-新增功能开发指南.md)。

## 本地开发

需要 Node.js 22、npm 10 和 PostgreSQL。复制 `.env.example` 为 `.env`，修改数据库连接后执行：

```powershell
npm ci
npm run workspace:init
npm run db:migrate
npm run auth:init
npm run dev
```

`npm run auth:init` 会在终端中安全地提示输入密码，密码不会写入仓库或命令行历史。浏览器访问 `http://localhost:5173`，用户名固定为 `owner`。

## 质量检查

```powershell
npm run openapi:generate
npm run check
```

`npm run check` 依次执行 ESLint、严格 TypeScript 检查、自动化测试和生产构建。真实 PostgreSQL 备份恢复演练及容器构建由 GitHub Actions 执行。

## 部署和迁移

生产部署使用 Caddy 提供 HTTPS 和同源反向代理，API 与 PostgreSQL 不暴露公网端口。完整流程见[部署、备份与恢复](docs/04-部署备份与恢复.md)。

架构约束和界面决策分别记录在：

- [01-架构文档](docs/01-架构文档.md)
- [02-工作台主体设计文档](docs/02-工作台主体设计文档.md)

## 状态说明

代码、文档和自动化产物完成后属于 `PREPARED`；实际通过的类型检查、测试、构建和恢复演练才属于对应范围的 `VERIFIED`。是否满足个人长期使用习惯仍由实际使用验收决定。
