# ticket-0024: 主动搜索轮询

## 目标

为 MCP Server 添加后台定时搜索新推文功能，与跟进检查独立运行。

## 背景

当前 `replyflow_list` 需要用户主动调用。用户可能错过实时讨论。

## 任务清单

- [ ] Config 增加 `searchInterval` 字段（分钟，默认 10，0=禁用）
- [ ] 新建 `src/search-poller.ts`（或集成到 `src/index.ts`）
  - `SearchPoller` 类，与 FollowUpChecker 同级
  - 构造函数接收 config，启动 `setInterval`
  - 每次触发调用 `getEffectiveConfig()` + `getTrendingPosts()` 获取新推文
  - 内部维护已见推文 ID 的 Set（`new Set<string>()`），用于去重
  - 有新推文时 logger.info：`Found {n} new tweet(s) worth replying — run replyflow_list to view`
  - 无新内容时 logger.debug
  - `stop()` 方法清理定时器
- [ ] `startServer()` 末尾启动 SearchPoller
- [ ] 与 FollowUpChecker 共用 cleanup（SIGINT/SIGTERM）
- [ ] 不影响现有 `replyflow_list` tool 行为
- [ ] 搜索关键词使用当前活跃项目的关键词（与 `replyflow_list` 一致）

## 产出标准

- [ ] `npm test` 全部通过
- [ ] `searchInterval: 0` 时不启动轮询
- [ ] Server shutdown 时定时器清理
- [ ] 不重复提醒已见过的推文

## 依赖

- ticket-0014（结构化日志）— 使用 logger 输出
- ticket-0015（CLI 健壮性）— 搜索使用 getTrendingPosts
- ticket-0016（缓存）— 搜索结果缓存影响去重逻辑
