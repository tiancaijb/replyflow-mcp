# ReplyFlow MCP Server

> **性质**：纯开源项目，面向开发者。用户直接从 GitHub 安装使用。

## 一句话

ReplyFlow MCP Server 是一个给独立开发者管理 Twitter 回复的 MCP 工具。
任何支持 MCP 的 AI agent（Cursor / Claude Code / pi-agent / Windsurf）都能调用。

**核心理念**：项目中心化。配置你的项目信息和关键词 → AI agent 自动找到相关讨论 → 你自然地在对话中推广项目。

## 目标用户

英文市场独立开发者，在 Twitter 上 build in public。

## 产品形态

- **核心**：MCP Server（提供多个 tool）
- **封装**：CLI wrapper（`npx replyflow-mcp`）

## MCP Tools

1. **replyflow_list** — 按项目关键词搜索值得回复的帖子
   - 只有 niche search，不再拉取 timeline/mentions
   - 帖子按互动量排序
   - 已回复的帖子标记 `replied: true`
   - 参数：`project`（可选，指定项目名，覆盖当前激活项目）

2. **replyflow_copy** — 把回复复制到剪贴板
   - 调用时自动记录到回复历史
   - 参数：`text`
   - 返回：`copied: true` + 历史记录 ID

3. **replyflow_update_config** — 更新配置
   - 支持设置/切换项目：`project`, `projectName`, `projectDescription`, `projectUrl`, `projectKeywords`
   - 支持设置全局：`keywords`（保底关键词）, `style`（回复风格）

4. **replyflow_config_status** — 查看配置状态
   - 返回当前激活的项目信息、所有项目列表、配置详情

5. **replyflow_history** — 查看回复历史记录
   - 参数：`tweetId`（可选，按帖子查）、`limit`（可选，默认 20）、`status`（可选，按状态筛选）
   - 返回中增加 `status` 字段（`sent` / `replied` / `followed_up`）

6. **replyflow_followups** — 查看待跟进对话
   - 参数：`markAsFollowedUp`（可选，按 ID 标记为已跟进）
   - 先检查所有 `sent` 状态的帖子是否有新回复
   - 返回需要跟进的对话列表（原始帖子 + 对方的回复）

7. **replyflow_switch_account** — 切换 Twitter 账号（仅用于 twitter-cli 认证）
   - 参数：`account`（账号名称）

## 发帖策略

不接入 Twitter Write API。用户「复制→粘贴→发布」。

## 项目配置

每个项目包含：

- `name`：项目名称
- `description`：一句话描述
- `url`：项目链接
- `keywords`：用于搜索相关讨论的关键词列表

支持多项目配置，通过 `activeProject` 切换当前激活的项目。

## 认证方式

使用 [twitter-cli](https://github.com/tiancaijb/twitter-cli)（Python CLI 工具）作为数据后端。
twitter-cli 使用浏览器 Cookie 认证，无需 Twitter API Key，不受 API 配额限制。
用户只需安装 twitter-cli 并执行一次 `twitter status` 完成浏览器登录即可。

## 配置存储

- **配置文件**：`~/.replyflow/config.json`
- **多账号**：`~/.replyflow/active_account`（仅用于 twitter-cli 认证切换）

## 回复历史

- **存储**：`~/.replyflow/history.json`
- **自动记录**：`replyflow_copy` 调用时记录
- **查询**：通过 `replyflow_history` tool
- **状态追踪**：每个条目有 `status` 字段（`sent` / `replied` / `followed_up`），支持回复链追踪

## 回复链追踪

- **`sent`**：已复制回复，尚未检测到新回复
- **`replied`**：`checkForReplies()` 检测到对方有新回复
- **`followed_up`**：已跟进处理（通过 `replyflow_followups markAsFollowedUp=<id>` 或 `updateEntryStatus`）

检测逻辑：对每个 `status === "sent"` 的条目，调用 `twitter tweet <tweetId> --json -n 5`，检查是否有来自非原帖作者且非本人的回复。

## 技术栈

- Node.js / TypeScript
- @modelcontextprotocol/sdk
- twitter-cli（Python CLI，通过 child_process 调用）
- 无外部 API 依赖

---

# Phase 2 — 质量与生态

> 第一批（Phase 1）实现了完整的功能集。Phase 2 聚焦测试覆盖、工程健壮性、CI/CD、文档和体验优化。

---

## 方向 1：setup.ts 测试覆盖

### 问题陈述

`src/setup.ts` 是交互式配置入口（`npx replyflow-mcp setup`），包含 6 步 CLI 引导流程，当前测试覆盖为 0。

### 用户故事

- 作为开发者，我想确保 setup 流程的所有路径（正常保存、取消、默认值、空输入）都经过测试

### 验收标准

- [ ] 测试 `stepProjectName`：空输入返回 false，正常输入返回项目名
- [ ] 测试 `stepProjectDescription` / `stepProjectUrl` / `stepKeywords` / `stepReplyStyle`：各自输入和默认值路径
- [ ] 测试完整流程 `runInteractiveSetup`：所有步骤走完→`updateEffectiveConfig` 被调用
- [ ] 测试取消路径：任意步骤返回空或 n → 不保存，返回 false
- [ ] 测试语言步骤：空字符串→language 为 undefined；有值→写入 config
- [ ] 不修改 `src/setup.ts` 生产代码

### 实施决策

- 用 `vi.mock('node:readline/promises')` 模拟 readline，控制 `rl.question` 返回值序列
- 测试文件：`tests/setup.test.ts`

---

## 方向 2：npm 自动发布 CI/CD

### 问题陈述

项目已配置 `package.json`（bin, files, MIT license），但缺少自动化发布流程。手动发布容易出错、忘记版本号。

### 用户故事

- 作为维护者，我不想手动 `npm publish`，希望 push tag 后自动发布
- 作为维护者，我想在 PR 合并时自动运行测试和构建

### 验收标准

- [ ] `.github/workflows/publish.yml` — 当 push tag `v*` 时自动构建、测试、发布到 npm
- [ ] `.github/workflows/ci.yml` — 每次 push/PR 运行 `npm test` + `npm run build`
- [ ] `package.json` 添加 `publishConfig.access: public`
- [ ] npm 发布前运行 `npm run build` 确保 dist/ 最新
- [ ] 发布消息包含版本号和 changelog

### 实施决策

- 直接用 GitHub Actions + npm publish（不引入 semantic-release 减少依赖）
- 使用 `secrets.NPM_TOKEN` 进行 npm 认证
- CI 与 publish 分离为两个 workflow

---

## 方向 3：Twitter CLI 健壮性

### 问题陈述

`runTwitter()` 使用 `spawnSync` 调用 twitter-cli，当前无超时控制、无重试逻辑、错误消息原始（stderr 直接暴露）。

### 用户故事

- 作为用户，当 twitter-cli 超时时，工具应返回清晰错误而非 hang
- 作为用户，当网络抖动导致 twitter-cli 失败时，工具应自动重试
- 作为用户，当认证过期时，应提示重新认证而非抛出 cryptic error

### 验收标准

- [ ] 超时控制：`spawnSync` 增加 `timeout` 参数（默认 30s），超时抛出 TimeoutError
- [ ] 重试退避：网络错误（ECONNRESET/ETIMEDOUT）自动重试最多 2 次，间隔 1s/3s
- [ ] 错误分类：区分 NetworkError / AuthError / RateLimitError / ParseError
- [ ] 错误消息：分类后的用户友好消息，而非原始 stderr
- [ ] Auth 检测：CLI 返回 401/403 时抛出 AuthError，提示 `twitter status` 重新认证
- [ ] 向后兼容：现有工具行为不受影响（错误 `catch` 仍返回 `{ error: message }`）

### 实施决策

- `runTwitter()` 内部封装超时 + 重试 + 分类逻辑
- 新增 `errors.ts` 定义错误类和分类函数
- 重试仅在可恢复的错误类型上执行（不是所有错误都重试）

---

## 方向 4：缓存机制

### 问题陈述

当前 `getTrendingPosts()` 每次调用都执行 twitter-cli 进程，同一关键词在短时间内重复搜索浪费资源。`getMe()` 已有简单缓存但缺少显式失效。

### 用户故事

- 作为用户，短时间内重复 `replyflow_list` 应使用缓存而非重复调用 CLI
- 作为用户，切换账号或更新配置后缓存应自动失效

### 验收标准

- [ ] `getTrendingPosts` 结果缓存：相同关键词 + 相同账号在 TTL（默认 60s）内返回缓存
- [ ] TTL 可配置：通过环境变量 `REPLYFLOW_CACHE_TTL` 或 config 字段
- [ ] 缓存失效时机：切换账号、更新关键词配置
- [ ] `resetClient()` 同时清空所有缓存
- [ ] 内存缓存（非持久化），进程重启即清空
- [ ] 缓存命中/未命中日志（debug 级别）

### 实施决策

- 新增 `src/cache.ts`：TTL Map 实现，支持 `get/set/delete/clear/keys/filter`
- `getMe()` 移到缓存管理下，统一失效
- 缓存 key = `${account}:keywords:${sorted_keywords}`

---

## 方向 5：结构化日志

### 问题陈述

当前所有输出用 `console.error` 直接打印，无级别区分、无上下文、无法控制输出量。MCP 协议要求所有日志走 stderr，但内容需要规范。

### 用户故事

- 作为开发者调试，我想看到 debug 级别的详细信息
- 作为终端用户，我只想看 warn/error 级别的重要信息
- 作为 MCP 客户端集成方，我希望日志格式一致方便排查

### 验收标准

- [ ] 日志分级：debug / info / warn / error
- [ ] 日志函数：`logger.debug()` / `.info()` / `.warn()` / `.error()`，统一加 `[ReplyFlow]` 前缀
- [ ] 可配置级别：环境变量 `LOG_LEVEL`（默认 `info`）或 config 字段 `logLevel`
- [ ] 日志输出始终走 stderr（不干扰 MCP stdio）
- [ ] 所有现有 `console.error` 替换为 logger 调用
- [ ] 日志格式：`[ReplyFlow] [级别] 消息`（可选附加上下文）

### 实施决策

- 新增 `src/logger.ts`：轻量级 logger，无外部依赖
- 设计为默认导出单例，也可创建带上下文的子 logger
- 不引入 winston/pino 等重量级库

---

## 方向 6：集成测试套件

### 问题陈述

当前 4 个测试文件全部用 `vi.mock('fs')` 模拟文件系统，没有真正执行 twitter-cli 的集成测试。核心流程（config + history + twitter）的端到端路径未覆盖。

### 用户故事

- 作为开发者，我想在 CI 中运行集成测试确保核心流程在真实环境可用
- 作为开发者，我希望有 mock CLI 服务器可以在无 twitter-cli 环境下测试

### 验收标准

- [ ] Mock CLI 服务器：一个轻量级 HTTP 或 stdio mock 替代 twitter-cli，返回预录 fixture
- [ ] 集成测试 `tests/integration/`：覆盖 `config → twitter list → history → followups` 的端到端流程
- [ ] Fixture 数据：预录的 search/whoami/tweet 响应（JSON 文件）
- [ ] CI 中运行集成测试：GitHub Actions 中 npm test 包含集成测试
- [ ] 单元测试和集成测试分离：`npm run test:unit` / `npm run test:integration`
- [ ] Mock CLI 可以模拟错误场景（超时、auth 失败、rate-limit）

### 实施决策

- Mock 策略：替换 `spawnSync` 调用为 fixture 查找（通过环境变量开关）
- 或：提供一个 `mock-twitter` 脚本替代 `twitter` 命令
- 测试 fixture 存放：`tests/fixtures/` 目录
- 优先使用 `REPLYFLOW_MOCK_CLI=true` 环境变量开关方式（无需额外进程）

---

## 方向 7：定时跟进检查

### 问题陈述

当前 `replyflow_followups` 需要用户主动调用。用户可能忘记检查待跟进对话，错过互动机会。

### 用户故事

- 作为用户，我希望服务器启动后自动轮询检查待跟进对话，发现新回复时通过 stderr 日志提醒我

### 验收标准

- [ ] 服务器启动时启动后台定时器，默认每 5 分钟检查一次 `sent` 条目的新回复
- [ ] 检查间隔可配置：config 字段 `followupInterval`（分钟，设为 0 关闭）
- [ ] 发现新回复时 logger.info 输出：`Found X new reply/ies — run replyflow_followups to view`
- [ ] 节流：单次检查间隔内最多调用一次 `checkForReplies()`
- [ ] MCP Server shutdown 时清理定时器
- [ ] 不影响 MCP stdio 协议（所有输出走 stderr logger）
- [ ] 已有 `replyflow_followups` tool 行为不变

### 实施决策

- 在 `startServer()` 末尾启动 `setInterval`
- 定时器引用存储在 server 级变量，用于清理
- 检查逻辑复用已有的 `checkForReplies()` 和 `getFollowUpTweets()`

---

## 方向 8：文档站 / 使用指南

### 问题陈述

项目已开源（MIT），README.md 包含基本用法，但缺少完整的文档站、多客户端配置示例、截图和视频演示。

### 用户故事

- 作为新用户，我希望有独立文档站展示安装、配置、使用示例
- 作为用户，我想看到不同 MCP 客户端（Claude Code / Cursor / pi-agent）的具体配置

### 验收标准

- [ ] 文档站基于 GitHub Pages 部署
- [ ] 使用 Vitepress 构建（与项目技术栈一致：Vite/TypeScript）
- [ ] 页面覆盖：首页介绍 / 安装指南 / 配置说明 / 工具参考 / 客户端配置 / FAQ
- [ ] 每个 MCP tool 有独立文档页，含参数说明和示例输出
- [ ] 客户端配置示例：Claude Code `claude_desktop_config.json`、Cursor MCP 配置、pi-agent 配置
- [ ] 操作截图或 GIF 演示
- [ ] 文档站自动部署：push 到 `docs/` 目录或特定分支时自动构建 GitHub Pages

### 实施决策

- 在项目根目录创建 `docs/` 子目录，Vitepress 项目
- GitHub Actions 部署到 GitHub Pages
- 文档内容中文为主（与目标用户一致），关键词和 CLI 示例保持英文

---

# Phase 3 — 工程完备化

> Phase 2 补齐了测试、CI/CD、文档。Phase 3 聚焦代码质量基础设施、开发者体验和主动功能。

---

## 方向 1：ESLint + Prettier

### 问题陈述

项目无代码风格统一工具，不同开发者的提交格式不一致。CI 中没有代码质量检查。

### 用户故事

- 作为贡献者，我想在提交时自动格式化代码
- 作为维护者，我想在 CI 中强制代码风格统一

### 验收标准

- [ ] ESLint flat config（`eslint.config.js`）配置 TypeScript 规则
- [ ] Prettier 配置（`.prettierrc`）
- [ ] `package.json` 添加 `lint` 和 `format` 脚本
- [ ] CI workflow 增加 lint 步骤
- [ ] 不引入大量外部 ESLint 插件（保持轻量）

### 实施决策

- ESLint flat config（v9+），使用 `@eslint/js` + `typescript-eslint`
- Prettier 独立于 ESLint（不引入 eslint-plugin-prettier）
- `npm run format` 调用 Prettier 自动修复
- `npm run lint` 调用 ESLint 检查

---

## 方向 2：Husky 提交前检查

### 问题陈述

无本地质量门禁。开发者可能在提交有类型错误或 lint 问题的代码，等到 CI 才发现。

### 用户故事

- 作为开发者，我在 `git commit` 时希望自动运行 lint + typecheck，拦截问题于本地

### 验收标准

- [ ] Husky 初始化（`.husky/pre-commit`）
- [ ] lint-staged 配置：对 staged `.ts` 文件运行 eslint --fix + prettier --write
- [ ] pre-commit typecheck：`tsc --noEmit`（可使用 tsconfig.build.json 排除测试）
- [ ] CI 验证 pre-commit hooks 存在
- [ ] `npm run prepare` 脚本自动安装 Husky

### 实施决策

- Husky v9（latest），使用 `husky init`
- lint-staged 独立配置在 `package.json` 中
- 类型检查在 pre-commit 中为可选 warning 模式（不阻塞提交）

---

## 方向 3：主动搜索轮询

### 问题陈述

用户需主动调用 `replyflow_list` 才发现新推文。错过实时讨论机会。

### 用户故事

- 作为用户，我希望服务器在后台自动搜索新推文，有新内容时提醒我

### 验收标准

- [ ] `startServer()` 末尾启动搜索轮询定时器（与跟进检查独立）
- [ ] 默认间隔：10 分钟，可通过 config `searchInterval` 配置（分钟，0=禁用）
- [ ] 每次轮询调用 `getTrendingPosts()` 获取新结果
- [ ] 结果去重：仅提醒新出现的推文（基于 id 去重）
- [ ] 有新推文时 logger.info：`Found {n} new tweet(s) worth replying — run replyflow_list to view`
- [ ] 无新内容时 logger.debug 输出
- [ ] Server shutdown 时清理定时器
- [ ] 不影响现有 `replyflow_list` tool 行为

### 实施决策

- 新增 `SearchPoller` 类或模块，与 FollowUpChecker 同级
- 内部维护已见推文 ID 的 Set，用于去重
- 复用已有的 `getTrendingPosts()` + `getNicheKeywords()`

---

## 方向 4：Docker 支持

### 问题陈述

部分用户希望容器化部署 MCP Server，当前缺少 Dockerfile 和文档。

### 用户故事

- 作为用户，我想用 Docker 运行 ReplyFlow，避免全局安装 Node.js

### 验收标准

- [ ] `Dockerfile` 多阶段构建（build → production）
- [ ] 基于 Node 22 Alpine 最小化镜像
- [ ] `.dockerignore` 排除不必要的文件
- [ ] `docker-compose.yml` 本地开发示例
- [ ] README 添加 Docker 使用说明

### 实施决策

- 多阶段构建：`node:22-alpine` → `npm ci && npm run build` → `node:22-alpine` (production)
- CMD 启动 MCP Server
- docker-compose 仅做参考，不引入复杂编排

---

## 方向 5：CLI 参数增强

### 问题陈述

当前 CLI 参数解析是手写的 `process.argv.slice(2)`，不支持 `--version`、命令嵌套、参数校验。

### 用户故事

- 作为用户，我想用 `replyflow-mcp --version` 查看版本
- 作为用户，输入错误命令时看到友好提示而非静默启动

### 验收标准

- [ ] 引入 commander（或 yargs）作为 CLI 框架
- [ ] 子命令：`replyflow-mcp start`（默认，启动 MCP）、`replyflow-mcp setup`（交互式配置）、`replyflow-mcp --version`
- [ ] 参数校验：未知命令提示 `Unknown command` + 帮助信息
- [ ] 向后兼容：`replyflow-mcp`（无参数）= `replyflow-mcp start`

### 实施决策

- 使用 commander（最流行的 Node.js CLI 框架）
- 大幅修改 `main()` 函数结构
- 保持 `setup` 子命令行为不变

---

## 方向 6：依赖安全审计

### 问题陈述

项目无自动化依赖安全扫描，`npm audit` 可能发现漏洞而不自知。

### 用户故事

- 作为维护者，我希望依赖更新时自动收到 PR，减少手动检查

### 验收标准

- [ ] `.github/dependabot.yml` 配置 weekly npm 依赖更新
- [ ] `npm audit` 在 CI 中运行（不阻塞构建，仅 warning）
- [ ] 确认当前 `npm audit` 无 high/critical 漏洞

### 实施决策

- Dependabot 配置为 weekly 更新，group 批量 PR
- CI 中 `npm audit --audit-level=high` 作为独立 job（不阻塞）

---

## 方向 7：TypeScript 强化

### 问题陈述

当前 `tsconfig.json` 已启用 `strict: true`，但可进一步启用更细粒度的严格选项。

### 用户故事

- 作为开发者，我希望编译器捕获更多潜在错误

### 验收标准

- [ ] 启用 `noUncheckedIndexedAccess`（索引访问返回 `T | undefined`）
- [ ] 修复所有新增的类型错误
- [ ] 测试全部通过
- [ ] 构建通过

### 实施决策

- 逐个启用严格选项，每次修复所有错误
- 先启用 `noUncheckedIndexedAccess`（影响最大），其余按需
- `exactOptionalPropertyTypes` 暂不启用（影响 config 接口）
