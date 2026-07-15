# ReplyFlow MCP Server

> **性质**：纯开源项目，面向开发者。用户直接从 GitHub 安装使用。

## 一句话

ReplyFlow MCP Server 是一个给独立开发者管理 Twitter 回复的 MCP 工具。
任何支持 MCP 的 AI agent（Cursor / Claude Code / pi-agent / Windsurf）都能调用。

## 目标用户

英文市场独立开发者，在 Twitter 上 build in public。

## 产品形态

- **核心**：MCP Server（提供多个 tool）
- **封装**：CLI wrapper（`npx replyflow-mcp`）

## MCP Tools

1. **replyflow_list** — 拉今天值得回的帖子列表
   - 来源：用户 Timeline + @通知 + niche 热门帖
   - 帖子带完整上下文
   - 参数：`filter`（可选 all / mentions / timeline）
   - 已回复的帖子标记"已回"但不过滤

2. **replyflow_copy** — 把回复复制到剪贴板
   - 调用时自动记录到回复历史
   - 参数：`text`
   - 返回：`copied: true` + 历史记录 ID

4. **replyflow_update_config** — 更新配置
   - 参数：`keywords`, `style`

5. **replyflow_config_status** — 查看配置状态

6. **replyflow_history** — 查看回复历史记录
   - 参数：`tweetId`（可选，按帖子查）、`limit`（可选，默认 20）

7. **replyflow_switch_account** — 切换 Twitter 账号
   - 参数：`account`（账号名称）

## 发帖策略

不接入 Twitter Write API。用户「复制→粘贴→发布」。

## Twitter API

共享开发者的 Essential（免费）层 Key，用户配在环境变量中。

## 用户配置

- **当前账号配置**：`~/.replyflow/config.json`
- **多账号支持**：`~/.replyflow/accounts/<account-name>/config.json`
  - 独立配置：API Key / OAuth / Keywords / Style
  - 通过 `replyflow_switch_account` 切换

## 回复历史

- **存储**：`~/.replyflow/history.json`
- **自动记录**：`replyflow_copy` 调用时记录
- **查询**：通过 `replyflow_history` tool

## 技术栈

- Node.js / TypeScript
- @modelcontextprotocol/sdk
- Twitter API v2（Read）

