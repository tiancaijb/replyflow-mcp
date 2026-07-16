# ticket-0014: 结构化日志系统

## 目标

替换项目中的 `console.error` 为结构化分级日志系统，提高可观测性。

## 背景

当前所有日志使用 `console.error` 直接打印，无级别区分、无统一格式。
MCP 要求日志走 stderr，但内容需要规范以方便调试和用户排查。

## 任务清单

- [ ] 新建 `src/logger.ts`，实现轻量级 logger（无外部依赖）
  - 函数：`debug()`, `info()`, `warn()`, `error()`
  - 格式：`[ReplyFlow] [级别] 消息`
  - 始终输出到 stderr
- [ ] 可配置日志级别
  - 环境变量 `LOG_LEVEL`（`debug | info | warn | error`）
  - 默认级别：`info`
  - config 字段 `logLevel` 作为备选
- [ ] 支持带上下文的子 logger
  - `logger.child(context)` 返回新 logger，前缀增加 `[context]`
  - 用于模块级日志（如 `logger.child('config')`）
- [ ] 替换所有现有 `console.error` 为 logger 调用
  - `src/config.ts` — warn 级别
  - `src/index.ts` — info/error 级别
  - `src/twitter.ts` — debug/error 级别
  - `src/history.ts` — debug/error 级别
  - `src/setup.ts` — 保持 console.log/error（交互式 CLI 不走 logger）
- [ ] 在 `startServer()` 启动时输出 `SERVER_STARTED` 的 info 日志

## 产出标准

- [ ] `npm test` 全部通过
- [ ] logger 测试：`tests/logger.test.ts` — 各级别输出、级别过滤、子 logger 上下文
- [ ] 不引入外部依赖

## 依赖

- 无（独立任务）
- 后续 ticket-0020（定时跟进检查）依赖本 ticket 的 logger
