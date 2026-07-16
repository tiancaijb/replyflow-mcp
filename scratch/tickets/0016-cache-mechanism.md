# ticket-0016: 缓存机制

## 目标

为搜索结果和用户信息引入 TTL 内存缓存，减少重复的 twitter-cli 调用。

## 背景

`getTrendingPosts()` 每次调用都执行 twitter-cli 进程，同一关键词短时间重复搜索浪费资源。
`getMe()` 已有简单缓存（模块级变量 `_me`），但缺少显式失效策略。

## 任务清单

- [ ] 新建 `src/cache.ts`，实现 TTL Map 缓存
  - `CacheEntry<T>` 接口：`{ value: T, expiresAt: number }`
  - `CacheStore` 类：`get<T>(key)`, `set<T>(key, value, ttlMs?)`, `delete(key)`, `clear()`, `keys()`, `filter(predicate)`
  - 内部使用 `Map<string, CacheEntry>`
  - `get` 返回前检查过期，过期则删除并返回 undefined
- [ ] TTL 可配置
  - 环境变量 `REPLYFLOW_CACHE_TTL`（秒，默认 60）
  - config 字段 `cacheTTL` 作为备选
  - 单个操作可覆盖 TTL（如 getMe 缓存 300s）
- [ ] 集成到 twitter.ts
  - `getTrendingPosts`：key = `search:${account}:${sortedKeywords}`
  - `getMe`：key = `me:${account}`，TTL 300s
  - 缓存命中/未命中时 logger.debug 输出
- [ ] 缓存失效
  - `resetClient()` 调用 `cache.clear()`
  - `setActiveAccount()` 调用 `cache.clear()`
  - `updateEffectiveConfig()` 如果 keywords 变了则清相关缓存
- [ ] 导出单例 `cache` 和 `CacheStore` 类

## 产出标准

- [ ] `npm test` 全部通过
- [ ] 测试 `tests/cache.test.ts`：基本 set/get/过期/clear/filter、TTL 覆盖、并发安全
- [ ] 测试 twitter.ts 中缓存集成：`getTrendingPosts` 重复调用只执行一次 CLI

## 依赖

- ticket-0014（结构化日志）— 用于缓存命中/未命中日志（可降级：先 console.error，后替换为 logger）
