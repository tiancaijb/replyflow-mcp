# ticket-0015: Twitter CLI 健壮性增强

## 目标

为 `runTwitter()` 增加超时控制、错误分类和重试退避机制，提高工具可靠性。

## 背景

`src/twitter.ts` 中的 `runTwitter()` 使用 `spawnSync` 调用 twitter-cli，
当前无超时控制、无重试逻辑、错误消息直接暴露原始 stderr。

## 任务清单

- [ ] 超时控制
  - `spawnSync` 增加 `timeout` 参数，默认 30s
  - 超时时抛出 TimeoutError，错误消息："Twitter CLI timed out after {timeout}s"
- [ ] 错误分类
  - 新增 `src/errors.ts` 定义错误类：
    - `CliError`（基类）
    - `CliTimeoutError`（超时）
    - `CliAuthError`（认证失败，401/403）
    - `CliRateLimitError`（限流）
    - `CliNetworkError`（网络错误，ECONNRESET/ETIMEDOUT/ENOTFOUND）
    - `CliParseError`（JSON 解析失败）
  - 分类函数 `classifyCliError(err, stderr, exitCode)` → CliError 子类
- [ ] 重试退避
  - 仅可恢复错误（CliNetworkError）自动重试
  - 最多 2 次重试，间隔 1s / 3s（指数退避）
  - 认证错误、限流、解析错误不重试，直接抛出
- [ ] 用户友好错误消息
  - AuthError 提示："Twitter CLI auth failed — run 'twitter status' to re-authenticate"
  - TimeoutError 提示："Twitter CLI timed out — check network or increase timeout"
  - RateLimitError 提示："Twitter CLI rate limited — wait a moment and retry"
- [ ] 现有 catch 块向后兼容
  - `getTrendingPosts`、`getTweetWithReplies`、`list` 的 try/catch 不变
  - 错误仍被 catch 后返回 `[]` 或 `{ error: message }`

## 产出标准

- [ ] `npm test` 全部通过
- [ ] 测试 `tests/errors.test.ts`：各类错误分类、重试逻辑、超时
- [ ] 测试 `tests/twitter.test.ts` 补充：错误场景测试

## 依赖

- 无（独立任务）
