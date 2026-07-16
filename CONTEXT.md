# ReplyFlow MCP — 领域上下文

## 项目性质

回复管理 MCP 工具。帮助独立开发者在 Twitter 上通过回复自然推广项目。

## 核心概念

| 术语 | 说明 |
|------|------|
| **MCP Server** | Model Context Protocol 服务器，通过 stdio 提供 tools |
| **twitter-cli** | Python CLI 工具，用浏览器 Cookie 认证，无需 Twitter API Key |
| **Niche Search** | 按项目关键词搜相关推文，取代 timeline/mentions |
| **Reply Chain** | 回复链追踪：sent → replied → followed_up |
| **Project Config** | 按项目配置 name/description/url/keywords |
| **Active Account** | twitter-cli 的认证账号（仅用于 CLI 调用） |

## 8 个新方向的领域术语

### 1. setup.ts 测试

| 术语 | 说明 |
|------|------|
| **交互式配置** | readline/promises 驱动的 6 步 CLI 引导流程 |
| **readline mock** | 模拟用户输入以测试交互式流程 |
| **流程覆盖** | 正常保存、取消、默认值、空输入等路径 |

### 2. npm 自动发布 CI/CD

| 术语 | 说明 |
|------|------|
| **GitHub Actions** | CI/CD 工作流 |
| **npm publish** | 发布到 npm registry |
| **Semantic Release** | 语义化版本自动更新 |
| **publishConfig** | npm 发布配置（access, tag） |

### 3. Twitter CLI 健壮性

| 术语 | 说明 |
|------|------|
| **超时控制** | `spawnSync` 超时参数防止无限等待 |
| **重试退避** | 指数退避策略（exponential backoff） |
| **错误分类** | 网络错误 / auth 错误 / rate-limit / 解析错误 |
| **错误消息** | 用户可读的错误消息，而非原始 stderr |

### 4. 缓存机制

| 术语 | 说明 |
|------|------|
| **TTL 缓存** | Time-To-Live 过期策略 |
| **搜索缓存** | `getTrendingPosts` 结果缓存，减少 CLI 调用 |
| **缓存的缓存** | `getMe()` 结果缓存（当前已有简单实现） |
| **缓存失效** | 配置变更或账号切换时清空缓存 |

### 5. 结构化日志

| 术语 | 说明 |
|------|------|
| **日志分级** | debug / info / warn / error |
| **日志输出** | stderr（不干扰 MCP stdio 协议） |
| **日志上下文** | 请求 ID、账号、操作类型 |
| **配置项** | 可配置日志级别（环境变量或 config） |

### 6. 集成测试套件

| 术语 | 说明 |
|------|------|
| **twitter-cli sandbox** | 模拟 twitter-cli 返回数据的 mock 服务器 |
| **端到端测试** | 真实调用 MCP Server → mock CLI → 验证输出 |
| **测试 fixture** | 预录的 CLI 响应数据 |
| **CI 集成** | 在 GitHub Actions 中运行集成测试 |

### 7. 定时跟进检查

| 术语 | 说明 |
|------|------|
| **后台轮询** | `setInterval` 或 cron 定时检查新回复 |
| **主动推送** | stderr 日志通知（无 MCP 推送能力时的替代方案） |
| **节流控制** | 防抖、最小间隔避免频繁调用 CLI |
| **状态机** | sent → replied → followed_up 的完整流转 |

### 8. 文档站 / 使用指南

| 术语 | 说明 |
|------|------|
| **GitHub Pages** | 静态文档站托管 |
| **Vitepress / Docsify** | 文档生成框架 |
| **使用示例** | MCP 客户端（Claude Code / Cursor / pi-agent）配置示例 |
| **截图/GIF** | 操作演示 |

## 架构决策

### ADR-0001: twitter-cli 作为数据后端

- **状态**: 已采纳
- **理由**: 无需 Twitter API Key，无配额限制，浏览器 Cookie 认证
- **代价**: 依赖 Python CLI；同步 `spawnSync` 调用阻塞事件循环
