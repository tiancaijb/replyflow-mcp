# ReplyFlow MCP Server

> 给独立开发者用的 Twitter 回复管理 MCP 工具。
> 在 Cursor、Claude Code、Windsurf、pi-agent 中直接调用：拉帖子 → 生成回复 → 复制粘贴。

## 一句话

ReplyFlow 是一个 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) Server，提供多个 tool 帮你管理 Twitter 回复。任何支持 MCP 的 AI agent（Cursor、Claude Code、Windsurf、pi-agent）都能调用。

**后端使用 [twitter-cli](https://github.com/tiancaijb/twitter-cli)（Python）**，通过浏览器 Cookie 认证，无需 Twitter API Key，不受 API 配额限制。

## 功能

### replyflow_list — 拉今天值得回的帖子

合并三个来源：Timeline + @mentions + Niche Search（按关键词搜索）。去重、按互动量排序，已回复的帖子标记 `replied: true`。

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

每个账号独立配置（Keywords / Style），存储在 `~/.replyflow/accounts/<name>/config.json`。

## 快速开始

### 前置条件

安装 [twitter-cli](https://github.com/tiancaijb/twitter-cli)（Python 工具，使用浏览器 Cookie 认证）：

```bash
pip3 install twitter-cli

# 首次认证（会在浏览器打开 Twitter 授权页面）
twitter status
```

确认认证成功：

```bash
twitter whoami
# 应显示你的 Twitter 用户信息
```

### 安装 ReplyFlow

```bash
npm install -g replyflow-mcp
```

验证安装：

```bash
npx replyflow-mcp --help
```

### 配置

```bash
# 交互式配置（关键词 + 回复风格）
npx replyflow-mcp setup

# 配置特定账号
npx replyflow-mcp setup --account myaccount
```

配置保存在 `~/.replyflow/config.json`（默认）或 `~/.replyflow/accounts/<name>/config.json`（多账号）。

## MCP 客户端配置

### Cursor / Claude Code / Windsurf / pi-agent

```json
{
  "mcpServers": {
    "replyflow": {
      "command": "npx",
      "args": ["replyflow-mcp"]
    }
  }
}
```

Cursor 编辑 `~/.cursor/mcp.json`，Claude Code 编辑 `~/.claude/mcp.json`。

> ⚡ **无需任何环境变量** — twitter-cli 使用浏览器 Cookie 认证。

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
│   ├── setup.ts        # 交互式配置流程
│   ├── twitter.ts      # twitter-cli 封装
│   └── history.ts      # 回复历史记录
├── tests/              # Vitest 测试
├── scratch/            # 设计文档和 tickets
├── LICENSE
├── package.json
└── README.md
```

## License

MIT
