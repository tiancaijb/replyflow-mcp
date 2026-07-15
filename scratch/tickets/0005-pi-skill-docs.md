# 0009: pi-agent skill + 文档

## 目标

把 ReplyFlow MCP Server 封装成 pi-agent 可安装的 skill，并写使用文档。

## 任务清单

- [ ] 创建 pi-agent skill 结构：
  - `~/.pi/agent/skills/replyflow/SKILL.md`
  - 内容是 skill 的安装和使用说明
  - 告诉用户怎么安装 MCP Server、怎么配置
- [ ] 在 pi 的 MCP 配置中添加 ReplyFlow 的引导
  - 自动检测 `replyflow-mcp` 是否安装
  - 如果没装，提示用户安装
- [ ] 编写 README：
  - 项目简介
  - 安装指南
  - 配置说明
  - 使用示例（给出自然语言的 agent 指令）
- [ ] 编写 CLI 使用文档：
  - 列出所有可用命令
  - 示例用法

## 产出标准

- 用户按文档操作后能正常使用
- SKILL.md 清晰可读
- README 包含完整的安装和使用指南

## 依赖

Ticket #0002, #0003, #0004
