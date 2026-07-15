# ReplyFlow MCP Server

> 给独立开发者用的 Twitter 回复管理 MCP 工具。
> 在 Cursor、Claude Code、Windsurf、pi-agent 中直接调用：拉帖子 → 生成回复 → 复制粘贴。

## 一句话

ReplyFlow 是一个 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) Server，提供多个 tool 帮你管理 Twitter 回复。任何支持 MCP 的 AI agent（Cursor、Claude Code、Windsurf、pi-agent）都能调用。

## 功能

### replyflow_list — 拉今天值得回的帖子

合并三个来源：Timeline（需 OAuth） + @mentions（需 OAuth） + Niche Search（按关键词搜索）。去重、按互动量排序，已回复的帖子标记 `replied: true`。

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `filter` | `"all" \| "mentions" \| "timeline"` | `"all"` | 筛选来源 |

### replyflow_copy — 复制到剪贴板

自动记录回复历史。

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 回复内容 |

### replyflow_history — 查看回复历史

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `tweetId` | `string` | — | 按帖子 ID 筛选 |
| `limit` | `number` | `20` | 最近 N 条 |

### replyflow_update_config — 对话中改配置

| 参数 | 类型 | 说明 |
|------|------|------|
| `keywords` | `string[]` | 替换 niche 关键词列表 |
| `style` | `ReplyStyle` | 切换首选回复风格 |

### replyflow_config_status — 查看配置状态

返回配置完整性检查报告，含当前账号名。

### replyflow_switch_account — 切换 Twitter 账号

| 参数 | 类型 | 说明 |
|------|------|------|
| `account` | `string` | 账号名称（如 `"personal"`、`"work"`） |

每个账号独立配置（API Key / OAuth / Keywords / Style），存储在 `~/.replyflow/accounts/<name>/config.json`。

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
# 交互式配置
npx replyflow-mcp setup

# 配置特定账号
npx replyflow-mcp setup --account myaccount
```

这会引导你完成：
1. **Twitter API Key / Secret** — 从 [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard) 获取
2. **OAuth 2.0 PKCE（推荐）** — 授权读取 timeline 和 @mentions
3. **Niche 关键词** — 搜索相关帖子的关键词
4. **回复风格** — Curious（默认）/ Casual / Supportive / Thoughtful / Auto

配置保存在 `~/.replyflow/config.json`（默认）或 `~/.replyflow/accounts/<name>/config.json`（多账号）。

### 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `TWITTER_API_KEY` | 是 | Twitter Consumer Key |
| `TWITTER_API_SECRET` | 是 | Twitter Consumer Secret |
| `TWITTER_ACCESS_TOKEN` | 否 | OAuth 1.0a 用户 Token |
| `TWITTER_ACCESS_TOKEN_SECRET` | 否 | OAuth 1.0a 用户 Token Secret |

## MCP 客户端配置

### Cursor / Claude Code / Windsurf

```json
{
  "mcpServers": {
    "replyflow": {
      "command": "npx",
      "args": ["replyflow-mcp"],
      "env": {
        "TWITTER_API_KEY": "your_key",
        "TWITTER_API_SECRET": "your_secret"
      }
    }
  }
}
```

Cursor 编辑 `~/.cursor/mcp.json`，Claude Code 编辑 `~/.claude/mcp.json`。

## CLI 命令

```bash
npx replyflow-mcp                          # 启动 MCP Server
npx replyflow-mcp setup                    # 交互式配置
npx replyflow-mcp setup --account NAME     # 配置特定账号
npx replyflow-mcp --help                   # 查看帮助
```

## Agent 对话示例

```
你：看看今天有什么值得回的帖子
Agent：→ replyflow_list

你：给这条帖子写个回复
Agent：（自行生成回复内容）

你：用这个回复
Agent：→ replyflow_copy → 复制到剪贴板

你：切换到工作号
Agent：→ replyflow_switch_account → 已切换到 work

你：查一下我刚才回复过什么
Agent：→ replyflow_history → 返回最近 20 条记录
```

## 项目结构

```
replyflow-mcp/
├── src/
│   ├── index.ts        # MCP Server 入口 + 6 个 tool 定义
│   ├── config.ts       # 配置管理 + 多账号支持
│   ├── setup.ts        # 交互式配置流程（含 OAuth 2.0 PKCE）
│   ├── twitter.ts      # Twitter API 封装
│   └── history.ts      # 回复历史记录
├── tests/              # Vitest 测试
├── scratch/            # 设计文档和 tickets
├── LICENSE
├── package.json
└── README.md
```

## License

MIT
