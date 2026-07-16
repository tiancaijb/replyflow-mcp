# ticket-0026: CLI 参数增强

## 目标

引入 commander 作为 CLI 框架，替换手写 args 解析，支持子命令和参数校验。

## 背景

当前 `main()` 函数用 `process.argv.slice(2)` 手写解析，不支持 `--version`、参数校验、子命令嵌套。

## 任务清单

- [ ] 安装 `commander` 作为依赖
- [ ] 重构 `src/index.ts` 的 `main()` 函数
  - `replyflow-mcp start`（默认命令，启动 MCP Server，保留无参数兼容）
  - `replyflow-mcp setup`（交互式配置，行为不变）
  - `replyflow-mcp --version`（显示版本号）
  - `replyflow-mcp --help`（显示帮助信息）
- [ ] 子命令配置
  - `start` 命令：option `--log-level`、`--config-path`
  - `setup` 命令：行为与现有 `setup` 子命令一致
- [ ] 向后兼容
  - `replyflow-mcp`（无参数）等价于 `replyflow-mcp start`
  - 现有 MCP 客户端配置（`command: "npx replyflow-mcp"`）不受影响
- [ ] 参数校验
  - 未知命令显示 `error: unknown command 'xxx'` + 帮助
- [ ] 更新 `src/index.ts` 中的 help 文本
  - 替换手写的 console.log 帮助为 commander 自动生成的 help

## 产出标准

- [ ] `npm test` 全部通过
- [ ] `replyflow-mcp --version` 显示 `1.0.0`（或 package.json 版本）
- [ ] `replyflow-mcp --help` 显示完整的命令列表
- [ ] `replyflow-mcp unknown-command` 显示友好错误
- [ ] `replyflow-mcp`（无参数）启动 MCP Server
- [ ] `replyflow-mcp setup` 运行交互式配置

## 依赖

- 无（独立任务）
