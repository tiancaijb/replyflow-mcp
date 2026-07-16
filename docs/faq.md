# 常见问题

## 是否需要 Twitter API Key？

不需要。ReplyFlow 使用 [twitter-cli](https://github.com/tiancaijb/twitter-cli) 的浏览器 Cookie 认证，无需 Twitter API Key，不受 API 配额限制。

## 如何安装 twitter-cli？

```bash
pip3 install twitter-cli
twitter status
# 浏览器中登录 Twitter → 回到终端确认认证成功
```

## 支持哪些 AI Agent？

支持所有标准 MCP 协议的客户端：

- **Claude Code** — Anthropic 官方 CLI
- **Cursor** — AI IDE
- **pi-agent** — 开源 AI Coding Agent
- **Windsurf** — AI 驱动 IDE

## 可以直接发推吗？

不可以。ReplyFlow **只复制到剪贴板**，你需要手动粘贴发布。这是设计决策——让你保留对发推内容的完全控制。

## 配置存在哪里？

- 配置文件：`~/.replyflow/config.json`
- 回复历史：`~/.replyflow/history.json`
- 活跃账号：`~/.replyflow/active_account`

## 如何切换项目？

使用 `replyflow_update_config` 工具的 `project` 参数切换到其他项目，或直接编辑 `~/.replyflow/config.json`。

## 如何切换账号？

使用 `replyflow_switch_account` 工具切换。前提是你已经通过 twitter-cli 认证了多个账号。

## 日志太多怎么办？

设置环境变量 `LOG_LEVEL=warn` 只显示警告和错误：

```bash
LOG_LEVEL=warn npx replyflow-mcp
```

## 如何贡献？

项目在 GitHub 开源，欢迎提交 Issue 和 PR：

[https://github.com/tiancaijb/replyflow-mcp](https://github.com/tiancaijb/replyflow-mcp)
