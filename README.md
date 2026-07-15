# ReplyFlow MCP Server

> 给独立开发者用的 Twitter 回复管理 MCP 工具。
> 在 Cursor、Claude Code、Windsurf、pi-agent 中直接调用的三把刀：拉帖子 → 生成回复 → 复制粘贴。

## 一句话

ReplyFlow 是一个 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) Server，提供三个 tool 帮你管理 Twitter 回复。任何支持 MCP 的 AI agent（Cursor、Claude Code、Windsurf、pi-agent）都能调用。

## 三个 Tool

### 1. `replyflow_list` — 拉今天值得回的帖子

```json
{
  "filter": "all"    // "all" | "mentions" | "timeline"
}
```

合并三个来源：
- **Timeline** — 你关注的人的帖子（需 OAuth 2.0）
- **@mentions** — 提到你的帖子（需 OAuth 2.0）
- **Niche Search** — 按关键词搜索相关帖子（App-only）

去重、按互动量排序，@mentions 自动带上下文链条。

### 2. `replyflow_generate` — 生成 AI 回复草稿

```json
{
  "tweetId": "123456789",
  "style": "curious"    // casual | curious | supportive | thoughtful | auto
}
```

- 上下文感知：自动拉帖子+回复链，理解语境再写
- 5 种风格：casual、curious（默认）、supportive、thoughtful、auto（AI 自动匹配）
- 输出 3 条草稿，每条附带 reason
- 强制 280 字符内、过滤套话
- 支持 Claude API（首选）和 OpenAI API（备选）

### 3. `replyflow_copy` — 复制到剪贴板

```json
{
  "text": "oh nice, been exploring a similar setup. what stack are you on?"
}
```

### 4. `replyflow_update_config` — 对话中改配置

```json
{
  "keywords": ["nextjs", "indie hacking"],
  "style": "supportive"
}
```

### 5. `replyflow_config_status` — 查看配置状态

无需参数，返回配置完整性检查报告。

## 快速开始

### 安装

```bash
npm install -g replyflow-mcp
```

验证安装：

```bash
npx replyflow-mcp --help
```

### 配置

```bash
# 交互式配置：Twitter API Key → OAuth 授权 → 关键词 → 风格 → LLM Key
npx replyflow-mcp setup
```

这会引导你完成：
1. **Twitter API Key / Secret** — 从 [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard) 获取
2. **OAuth 2.0 PKCE（可选）** — 授权读取你的 timeline 和 @mentions
3. **Niche 关键词** — 搜索相关帖子的关键词
4. **回复风格** — Curious（默认）/ Casual / Supportive / Thoughtful / Auto
5. **LLM API Key（可选）** — Anthropic 或 OpenAI

配置保存在 `~/.replyflow/config.json`。

### 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `TWITTER_API_KEY` | 是 | Twitter Consumer Key |
| `TWITTER_API_SECRET` | 是 | Twitter Consumer Secret |
| `TWITTER_ACCESS_TOKEN` | 否 | OAuth 1.0a 用户 Token |
| `TWITTER_ACCESS_TOKEN_SECRET` | 否 | OAuth 1.0a 用户 Token Secret |
| `ANTHROPIC_API_KEY` | 否* | 用于 AI 回复生成 |
| `OPENAI_API_KEY` | 否* | 备选 LLM |

\* 需至少一种 LLM Key 才能用 `replyflow_generate`。

环境变量优先级高于配置文件。

## MCP 客户端配置

### Cursor

编辑 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "replyflow": {
      "command": "npx",
      "args": ["replyflow-mcp"],
      "env": {
        "TWITTER_API_KEY": "your_key",
        "TWITTER_API_SECRET": "your_secret",
        "ANTHROPIC_API_KEY": "your_anthropic_key"
      }
    }
  }
}
```

### Claude Code

编辑 `~/.claude/mcp.json` 或项目 `.mcp.json`：

```json
{
  "mcpServers": {
    "replyflow": {
      "command": "npx",
      "args": ["replyflow-mcp"],
      "env": {
        "TWITTER_API_KEY": "your_key",
        "TWITTER_API_SECRET": "your_secret",
        "ANTHROPIC_API_KEY": "your_anthropic_key"
      }
    }
  }
}
```

### Windsurf

在 MCP 配置中添加：

```json
{
  "mcpServers": {
    "replyflow": {
      "command": "npx",
      "args": ["replyflow-mcp"],
      "env": {
        "TWITTER_API_KEY": "your_key",
        "TWITTER_API_SECRET": "your_secret",
        "ANTHROPIC_API_KEY": "your_anthropic_key"
      }
    }
  }
}
```

## CLI 命令参考

```bash
npx replyflow-mcp                 # 启动 MCP Server（stdio 模式）
npx replyflow-mcp setup           # 交互式配置
npx replyflow-mcp --help          # 查看帮助
```

## Agent 对话示例

以下是在支持 MCP 的 agent 中的使用示例：

```
你：看看今天有什么值得回的帖子
Agent：[调用 replyflow_list → 返回帖子列表]
你：给这条帖子生成回复，用 supportive 风格
Agent：[调用 replyflow_generate → 返回 3 条草稿]
你：用第二条
Agent：[调用 replyflow_copy → 复制到剪贴板]
你：已粘贴到 Twitter 发布了
```

```
你：更新我的关键词为 ['nextjs', 'tailwindcss', 'typescript']
Agent：[调用 replyflow_update_config → 关键词已更新]
```

```
你：检查一下配置有没有问题
Agent：[调用 replyflow_config_status → 返回配置检查报告]
```

## 技术栈

- **Node.js / TypeScript** — 运行环境
- **@modelcontextprotocol/sdk** — MCP 协议实现
- **twitter-api-v2** — Twitter API v2 客户端
- **Claude API / OpenAI API** — AI 回复生成
- **Zod** — 参数验证

## OAuth 2.0 PKCE 流程

ReplyFlow 使用 OAuth 2.0 PKCE（Proof Key for Code Exchange）进行用户授权：

1. `npx replyflow-mcp setup` → 生成授权链接
2. 在浏览器中打开链接，授权 Read 权限
3. Twitter 回调到 `http://localhost:54321/callback`
4. 本地 HTTP 服务接收 code → 交换为 access token
5. Token 持久化到 `~/.replyflow/config.json`
6. 过期后自动用 refresh token 刷新

> **注意：** 需要在 Twitter Developer Portal 中将 `http://localhost:54321/callback` 添加为 OAuth 2.0 回调 URL。

## 无需用户授权的功能

即使没有完成 OAuth 2.0 授权，以下功能仍然可用：

- **Niche Search** — 按关键词搜索相关帖子（App-only）
- **`replyflow_generate`** — 只要帖子 ID 正确，可以生成回复
- **`replyflow_copy`** — 纯客户端操作

需要 OAuth 2.0 的功能：

- **Timeline** — 读取你的 Home Timeline
- **@mentions** — 读取你的 @通知

## 项目结构

```
replyflow-mcp/
├── src/
│   ├── index.ts        # MCP Server 入口 + 5 个 tool 定义
│   ├── config.ts       # 配置管理（读/写/校验/环境变量合并）
│   ├── setup.ts        # 交互式配置流程（含 OAuth 2.0 PKCE）
│   ├── twitter.ts      # Twitter API 封装（timeline/mentions/search/context）
│   └── generate.ts     # AI 回复生成（Claude API + OpenAI API 备选）
├── dist/               # 编译输出
├── scratch/            # 设计文档和 tickets
├── package.json
├── tsconfig.json
└── README.md
```

## License

ISC
