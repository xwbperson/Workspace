# 个人工作台

个人工作台是一个供固定 `owner` 账户使用的响应式 Web/PWA 应用。PC 和 Android 浏览器共享同一套数据、路由和业务逻辑；新增普通功能只需接入固定注册点，不需要重写工作台主体。

## Windows 快速开始

准备 Node.js 22.12 或更高版本和 npm 10 或更高版本，然后双击 `workbench-local.bat`，选择 **1. Start and open browser**。也可以在 PowerShell 中运行：

```powershell
.\workbench-local.bat start
```

脚本会在需要时安装依赖，使用临时内存数据库启动前后端，生成 `owner` 的临时密码并复制到剪贴板，然后打开 `http://127.0.0.1:5173`。停止时会删除本次临时数据：

```powershell
.\workbench-local.bat status
.\workbench-local.bat restart
.\workbench-local.bat stop
```

这个模式适合快速体验和界面检查，不用于保留数据。需要持久化数据时，请使用下方的 PostgreSQL 本地开发流程。

## 当前能力

- PC 使用左侧导航，Android 使用底部导航；两套布局共享同一功能页面。
- 总览页聚合当前关注、未来时间轨道、功能摘要和最近内容。
- 功能汇总页展示全部可见功能；所有功能默认显示在侧边栏，可在设置中隐藏或调整顺序。
- 支持全局搜索、快速创建、通知和设置，并按模块声明的能力聚合内容。
- 提供深色、浅色和玻璃三种完整主题，默认使用深色主题。
- 只有一个固定 `owner` 账户，不提供注册、多用户、角色或租户功能。
- 可选长期登录：空闲期限 180 天、绝对期限 365 天；服务端会轮换 Session，前端不保存认证令牌。
- 单一工作区根目录、PostgreSQL 逻辑备份、SHA-256 校验和，以及恢复到新空目录和新空数据库的命令。
- PWA 静态资源离线缓存；认证 API 响应不会进入 Service Worker 缓存。

## 已实现功能

| 功能       | 主要用途                                         |
| ---------- | ------------------------------------------------ |
| 倒计时     | 管理重要日期、完成状态和时间轨道                 |
| 书籍管理   | 管理书目、章节页码和阅读进度                     |
| 课程管理   | 管理课程、上课记录、作业、资料和大纲             |
| 目标管理   | 管理年度、季度和月度目标，以及数值进度和关键结果 |
| 任务管理   | 管理多级任务、优先级、截止时间和重复事项         |
| 日程管理   | 使用月历管理行程、日记和当日总结                 |
| 课程表     | 按教学周管理上课时间、教师、教室、周次和临时调课 |
| 收集箱     | 收集想法、片段、网址和文件                       |
| 订阅管理   | 管理续费日期并折算月均成本                       |
| 财务管理   | 汇总资金账户、信用额度、月度负债和年度趋势       |
| 人生倒计时 | 展示人生、今年和今天的时间进度并记录人生节点     |
| 清单       | 管理可勾选清单、自动完成状态、归档及金额汇总     |

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

倒计时仍作为最小参考切片。新增功能的完整步骤见[功能模块添加文档](docs/03-功能模块添加文档.md)。

## 本地开发

需要 Node.js 22.12 或更高版本、npm 10 或更高版本和 PostgreSQL。复制 `.env.example` 为 `.env`，修改数据库连接和应用来源后执行：

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

`npm run check` 依次执行 Prettier 格式检查、ESLint、严格 TypeScript 检查、自动化测试和生产构建。真实 PostgreSQL 备份恢复演练及容器构建由 GitHub Actions 执行。

## 部署和迁移

生产部署使用 Caddy 提供 HTTPS 和同源反向代理，API 与 PostgreSQL 不暴露公网端口。完整流程见[部署、备份与恢复](docs/04-部署备份与恢复.md)。

完整文档：

- [01-架构文档](docs/01-架构文档.md)
- [02-工作台主体设计文档](docs/02-工作台主体设计文档.md)
- [03-功能模块添加文档](docs/03-功能模块添加文档.md)
- [04-部署、备份与恢复](docs/04-部署备份与恢复.md)
- [05-课程表功能设计文档](docs/05-课程表功能设计文档.md)

## 状态说明

代码、文档和自动化产物完成后属于 `PREPARED`；实际通过的类型检查、测试、构建和恢复演练才属于对应范围的 `VERIFIED`。是否满足个人长期使用习惯仍由实际使用验收决定。
