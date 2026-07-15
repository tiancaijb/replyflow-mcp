# 0006: Twitter 数据获取

## 目标

实现 `replyflow_list` tool 的真实数据获取：从 Twitter API 拉 Timeline、@通知、热门帖。

## 任务清单

- [ ] 安装 Twitter API v2 客户端（`twitter-api-v2` npm 包）
- [ ] 实现 `getTimeline()` — 拉取用户 Home Timeline（最近 20 条帖子）
- [ ] 实现 `getMentions()` — 拉取用户的 @ 通知（最近 20 条）
- [ ] 实现 `getTweetContext(tweetId)` — 获取帖子的完整上下文链条：
  - 如果是回复，递归拉父帖子直到根
  - 返回 `{ root, replies: [...] }` 结构
- [ ] 实现 `getTrendingPosts(keywords)` — 按关键词搜索 niche 热门帖
  - 使用关键词组合（"indie dev SaaS build in public"）
  - 按互动率排序
- [ ] 帖子去重和合并（Timeline 和 @ 通知中可能重复）
- [ ] `replyflow_list` 对接真实数据：
  - 参数 `filter`：`all`（合并所有来源）/ `mentions`（仅@通知）/ `timeline`（仅时间线+热门）
  - 每条帖子带上 `context` 字段（如果有上下文）
  - 返回前按「互动数 × 相关性」排序

## 产出标准

- `replyflow_list` 返回真实的 Twitter 帖子数据
- @通知中的帖子能正确带上下文链条
- 关键词搜索返回 niche 相关帖
- 错误处理（API 限流、未授权等）

## 依赖

Ticket #0001（需要 config 和 env 支持）
