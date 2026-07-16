# ticket-0020: 定时跟进检查

## 目标

为 MCP Server 添加后台定时轮询，自动检查待跟进回复并提醒用户。

## 背景

当前 `replyflow_followups` 需要用户主动调用。用户可能忘记检查待跟进对话，错过互动机会。

## 任务清单

- [ ] 定时器启动
  - `startServer()` 末尾启动 `setInterval`
  - 默认间隔：5 分钟
  - 间隔可配置：config 字段 `followupInterval`（分钟，设为 0 禁用）
  - 服务器启动时日志输出："Follow-up checker enabled (interval: {interval}min)"
- [ ] 检查逻辑
  - 每次触发调用 `checkForReplies()` 检测新回复
  - 有发现时 logger.info 输出日志：
    - 单数："Found 1 new reply on tweet {tweetId} — run replyflow_followups to view"
    - 复数："Found {n} new replies — run replyflow_followups to view"
  - 无发现时 logger.debug 输出（不打扰用户）
- [ ] 节流
  - 单次检查间隔内最多触发一次 `checkForReplies()`
  - `checkForReplies` 本身已有幂等性（只更新 sent→replied）
- [ ] 清理
  - Server shutdown 时 `clearInterval`
  - 监听 process 的 `SIGINT` / `SIGTERM` 清理定时器
- [ ] 日志
  - 所有输出使用 logger（来自 ticket-0014）
  - 日志级别：info（有新回复）/ debug（无新回复）
- [ ] 不影响现有 `replyflow_followups` tool 行为

## 产出标准

- [ ] `npm test` 全部通过
- [ ] 定时器在 MCP Server 启动时正确初始化
- [ ] 配置 `followupInterval: 0` 不启动定时器
- [ ] Server shutdown 时定时器清理（无内存泄漏）
- [ ] 不影响 MCP stdio 协议

## 依赖

- ticket-0014（结构化日志）— 定时器使用 logger 输出
