# ReplyFlow CLI 参考

## 概述

ReplyFlow 可以通过 CLI 以三种模式运行：

1. **MCP Server 模式**（默认）— 启动 stdio MCP Server，供 MCP 客户端连接
2. **Setup 模式** — 交互式配置向导
3. **Help 模式** — 显示帮助信息

## 命令

### `npx replyflow-mcp`

启动 MCP Server（stdio 模式）。供 Cursor、Claude Code、Windsurf 等 MCP 客户端连接。

```bash
# 默认启动
npx replyflow-mcp

# 或全局安装后
replyflow-mcp
```

启动后通过 stdin/stdout 进行 JSON-RPC 通信。MCP 客户端会自动处理协议细节。

### `npx replyflow-mcp setup`

交互式配置向导。引导用户完成：

1. **Twitter API Key / Secret** 输入
2. **OAuth 2.0 PKCE 授权**（可选）
3. **Niche 关键词** 配置
4. **回复风格** 选择
5. **LLM API Key** 输入（可选）

```bash
npx replyflow-mcp setup
```

配置内容会保存到 `~/.replyflow/config.json`。

### `npx replyflow-mcp --help`

显示帮助信息：

```bash
npx replyflow-mcp --help
```

## 环境变量

ReplyFlow 支持通过环境变量注入配置，优先级高于 `~/.replyflow/config.json`：

| 变量 | 支持的值 | 默认值 | 说明 |
|------|---------|--------|------|
| `TWITTER_API_KEY` | Twitter API Key | — | **必需**。Consumer Key |
| `TWITTER_API_SECRET` | Twitter API Secret | — | **必需**。Consumer Secret |
| `TWITTER_ACCESS_TOKEN` | OAuth 1.0a Access Token | — | 可选。用户上下文访问 |
| `TWITTER_ACCESS_TOKEN_SECRET` | OAuth 1.0a Access Token Secret | — | 可选。用户上下文访问 |
| `TWITTER_OAUTH2_CLIENT_ID` | OAuth 2.0 Client ID | — | 可选。PKCE 流程使用 |
| `ANTHROPIC_API_KEY` | Anthropic API Key | — | 可选。回复生成首选 |
| `OPENAI_API_KEY` | OpenAI API Key | — | 可选。回复生成备选 |

## 配置文件

路径：`~/.replyflow/config.json`

```json
{
  "twitterApiKey": "your_consumer_key",
  "twitterApiSecret": "your_consumer_secret",
  "oauth2ClientId": "your_oauth2_client_id",
  "oauth2AccessToken": "your_oauth2_access_token",
  "oauth2RefreshToken": "your_oauth2_refresh_token",
  "oauth2TokenExpiresAt": "2026-01-01T00:00:00.000Z",
  "anthropicApiKey": "your_anthropic_key",
  "nicheKeywords": ["indie dev", "saas", "build in public", "coding", "solopreneur"],
  "replyStyle": "curious"
}
```

## OAuth 2.0 回调

OAuth 2.0 PKCE 流程在本机打开临时 HTTP 服务，监听：

```
http://localhost:54321/callback
```

需要在 Twitter Developer Portal 中将该 URL 添加为 OAuth 2.0 回调 URL：
1. 进入 [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. 选择你的 Project → User authentication settings
3. 在 "OAuth 2.0" 部分添加 `http://localhost:54321/callback`
4. 设置 App permissions 为 "Read"
5. 设置 Type of App 为 "Native App" 或 "Web App, Automated App or Bot"
