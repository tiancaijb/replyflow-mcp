# ReplyFlow MCP Server

## 一句话

ReplyFlow MCP Server 是一个给独立开发者管理 Twitter 回复的 MCP 工具。
任何支持 MCP 的 AI agent（Cursor / Claude Code / pi-agent / Windsurf）都能调用。

## 目标用户

英文市场独立开发者，在 Twitter 上 build in public。

## MVP 核心模型

### 形态

- **核心**：MCP Server（提供 3 个 tool）
- **封装**：CLI wrapper（`npx replyflow-mcp`）+ pi-agent skill（后续）

### 三个 Tool

1. **replyflow_list** — 拉今天值得回的帖子列表
   - 来源：用户 Timeline + @通知 + niche 热门帖
   - 帖子带完整上下文
   - 参数：`filter`（可选 all / mentions / timeline）

2. **replyflow_generate** — 为帖子生成回复草稿
   - 上下文感知
   - 参数：`tweetId`, `style`（可选）
   - 返回：2-3 条草稿

3. **replyflow_copy** — 把回复复制到剪贴板
   - 参数：`text`

### 发帖策略

MVP 不接入 Twitter Write API。用户「复制→粘贴→发布」。

### Twitter API

MVP 共享开发者的 Essential（免费）层 Key，用户配在环境变量中。

### 用户配置

`~/.replyflow/config.json`，首次运行交互式配置，后续 agent 对话改。

## 技术栈

- Node.js / TypeScript
- @modelcontextprotocol/sdk
- Twitter API v2（Read）
- Claude API / OpenAI API
