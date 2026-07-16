# 客户端配置

ReplyFlow MCP Server 支持所有标准 MCP 客户端。以下是各客户端的配置方法。

## Claude Code

编辑 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "replyflow": {
      "command": "npx",
      "args": ["replyflow-mcp"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Cursor

在项目根目录创建 `.cursor/mcp.json`：

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

## pi-agent

在 `~/.pi/agent/config.yaml` 中添加：

```yaml
mcpServers:
  replyflow:
    command: npx
    args:
      - replyflow-mcp
```

## Windsurf

在 `~/.codeium/windsurf/mcp_config.json` 中添加：

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

## 验证配置

启动客户端后，确认可看到以下工具：

- `replyflow_list` — 搜索相关推文
- `replyflow_copy` — 复制回复到剪贴板
- `replyflow_update_config` — 更新配置
- `replyflow_config_status` — 查看配置状态
- `replyflow_history` — 查看回复历史
- `replyflow_followups` — 查看待跟进对话
- `replyflow_switch_account` — 切换 Twitter 账号
