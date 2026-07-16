# ReplyFlow MCP Server

[![CI](https://github.com/tiancaijb/replyflow-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/tiancaijb/replyflow-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/replyflow-mcp)](https://www.npmjs.com/package/replyflow-mcp)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[📖 文档站](https://tiancaijb.github.io/replyflow-mcp/)

> 给独立开发者用的 Twitter 回复管理 MCP 工具。
> 配置你的项目 → AI agent 自动找到相关讨论 → 你自然地参与交流。

## 一句话

ReplyFlow 是一个 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) Server，提供多个 tool 帮你管理 Twitter 回复。任何支持 MCP 的 AI agent（Cursor、Claude Code、Windsurf、pi-agent）都能调用。

**核心理念**：项目中心化。配置项目和关键词后，AI agent 搜索相关推文，你选择感兴趣的自然参与。

**后端使用 [twitter-cli](https://github.com/tiancaijb/twitter-cli)（Python）**，通过浏览器 Cookie 认证，无需 Twitter API Key，不受 API 配额限制。

## 功能

### replyflow_list — 按项目关键词搜索值得回复的帖子

只做 niche search（按项目关键词搜索），不再拉取 timeline/mentions。帖子按互动量排序，已回复的标记 `replied: true`。

| 参数      | 类型            | 说明                         |
| --------- | --------------- | ---------------------------- |
| `project` | `string` (可选) | 指定项目名，覆盖当前激活项目 |

### replyflow_copy — 复制到剪贴板

自动记录回复历史，支持回复链追踪。

| 参数               | 类型            | 说明                                     |
| ------------------ | --------------- | ---------------------------------------- |
| `text`             | `string`        | 回复内容                                 |
| `tweetId`          | `string` (可选) | 被回复的帖子 ID                          |
| `conversationId`   | `string` (可选) | 对话/线程 ID，用于回复链追踪             |
| `inReplyToTweetId` | `string` (可选) | 所回复的具体帖子 ID（与 tweetId 不同时） |
| `style`            | `string` (可选) | 回复风格                                 |

### replyflow_update_config — 对话中改配置

支持项目和全局配置。

| 参数                 | 类型         | 说明                             |
| -------------------- | ------------ | -------------------------------- |
| `project`            | `string`     | 激活或创建项目                   |
| `projectName`        | `string`     | 项目显示名称                     |
| `projectDescription` | `string`     | 项目描述                         |
| `projectUrl`         | `string`     | 项目 URL                         |
| `projectKeywords`    | `string[]`   | 项目关键词                       |
| `keywords`           | `string[]`   | 保底关键词（项目无关键词时使用） |
| `style`              | `ReplyStyle` | 切换首选回复风格                 |

### replyflow_config_status — 查看配置状态

返回当前项目信息、所有项目列表、配置详情。

### replyflow_history — 查看回复历史

| 参数      | 类型                                   | 默认 | 说明             |
| --------- | -------------------------------------- | ---- | ---------------- |
| `tweetId` | `string`                               | —    | 按帖子 ID 筛选   |
| `limit`   | `number`                               | `20` | 最近 N 条        |
| `status`  | `"sent" \| "replied" \| "followed_up"` | —    | 按回复链状态筛选 |

### replyflow_followups — 查看待跟进对话

检查已回复的帖子是否有新回复，返回需要跟进的对话列表。

| 参数               | 类型            | 说明                   |
| ------------------ | --------------- | ---------------------- |
| `markAsFollowedUp` | `number` (可选) | 将指定条目标记为已跟进 |

调用时不传参数：先检查所有 `sent` 状态的帖子是否有新回复，再返回当前 `replied` 状态的待跟进列表。

**回复链状态说明**：

- `sent`：已复制回复，尚未检测到新回复
- `replied`：对方已回复，需要跟进
- `followed_up`：已跟进处理

### replyflow_switch_account — 切换 Twitter 账号

| 参数      | 类型     | 说明                                    |
| --------- | -------- | --------------------------------------- |
| `account` | `string` | 账号名称（仅用于 twitter-cli 认证切换） |

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
# 交互式配置（项目信息 + 关键词 + 回复风格）
npx replyflow-mcp setup
```

配置保存在 `~/.replyflow/config.json`。

### Docker

```bash
# 构建镜像
docker build -t replyflow-mcp .

# 运行 MCP Server（挂载配置目录）
docker run -i --rm \
  -v ~/.replyflow:/root/.replyflow \
  replyflow-mcp
```

或者用 docker-compose：

```bash
docker compose up -d
```

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
npx replyflow-mcp --help                   # 查看帮助
```

## Agent 对话示例

```
你：看看今天有什么值得回的帖子（关于我的项目）
Agent：→ replyflow_list → 返回按项目关键词搜索的帖子

你：给这条帖子写个回复
Agent：（自行生成回复内容）

你：用这个回复
Agent：→ replyflow_copy → 复制到剪贴板

你：切换到另一个项目
Agent：→ replyflow_update_config project=my-other-app

你：查一下我刚才回复过什么
Agent：→ replyflow_history → 返回最近 20 条记录

你：看看有没有人回复了我
Agent：→ replyflow_followups → 检查回复链，返回待跟进对话

你：这条已跟进
Agent：→ replyflow_followups markAsFollowedUp=1 → 标记为已跟进
```

## 回复链追踪策略

推广策略 A：先正常参与讨论，对方回复后再自然地提项目。

```
Day 1: 发现相关讨论 → 回复帮助对方 → replyflow_copy 记录
Day 2: replyflow_followups 检测到对方回复了 → 再自然提项目
Day 3: 跟进后标记为已跟进
```

## 项目结构

```
replyflow-mcp/
├── src/
│   ├── index.ts        # MCP Server 入口 + 7 个 tool 定义
│   ├── config.ts       # 配置管理 + 项目支持
│   ├── setup.ts        # 交互式配置流程
│   ├── twitter.ts      # twitter-cli 封装
│   └── history.ts      # 回复历史记录 + 回复链追踪
├── tests/              # Vitest 测试
├── scratch/            # 设计文档和 tickets
├── LICENSE
├── package.json
└── README.md
```

## License

MIT
