# ticket-0033: MCP Resources

## 目标

将回复历史和配置状态暴露为 MCP Resources。

## 任务

- [ ] Resource `replyflow://config` — 当前配置（只读 JSON）
- [ ] Resource `replyflow://history/recent` — 最近 20 条回复历史
- [ ] 在 MCP server 注册 resources
- [ ] 集成测试覆盖

## 产出

- MCP 客户端可读取这些 resource
- 不影响现有 tools
