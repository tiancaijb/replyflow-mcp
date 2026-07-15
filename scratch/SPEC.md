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
