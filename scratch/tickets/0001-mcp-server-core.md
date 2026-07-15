# 0005: MCP Server 骨架

## 目标

搭建 ReplyFlow MCP Server 的基础框架：项目结构、配置管理、三个 tool 的空实现。

## 任务清单

- [ ] 初始化 npm 项目 `replyflow-mcp`（目录已创建）
- [ ] 安装 `@modelcontextprotocol/sdk`
- [ ] 创建 `src/index.ts`，作为 MCP Server 入口
- [ ] 实现三个 tool 的骨架（返回 placeholder 数据）：
  - `replyflow_list` → 返回空数组
  - `replyflow_generate` → 返回占位草稿
  - `replyflow_copy` → 返回 `{ copied: true }`
- [ ] 配置管理模块 `src/config.ts`：
  - 读取 `~/.replyflow/config.json`
  - 如果不存在，抛出引导信息
  - 提供 `getConfig()` 和 `updateConfig()` 接口
- [ ] 环境变量 `TWITTER_API_KEY` 和 `TWITTER_API_SECRET` 读取
- [ ] `bin/replyflow-mcp` 入口文件，用户 `npx replyflow-mcp` 启动

## 产出标准

- `npx replyflow-mcp` 能启动 MCP Server
- 用 MCP Inspector 能调用三个 tool
- 环境变量缺失时给出清晰的错误引导
- `~/.replyflow/config.json` 不存在时输出首次运行引导

## 依赖

无（新项目）
