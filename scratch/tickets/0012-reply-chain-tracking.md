# ticket-0012: 回复链追踪

## 目标

追踪回复链：当对方回复了你的回复时，标记为"待跟进"并可在历史中查看。

## 背景

推广策略 A：先正常参与讨论，对方回复后再自然地提项目。
这需要追踪哪些对话需要跟进（对方回了你的回复）。

## 任务清单

- [ ] **更新 `src/history.ts`**
  - 修改 `HistoryEntry` 接口，新增字段：
    - `conversationId`：对话 ID
    - `inReplyToTweetId`：回复的帖子 ID
    - `status`：`"sent" | "replied" | "followed_up"`
  - 新增 `checkForReplies()` 函数：遍历 history，检查是否有新的回复
    - 对每个 status 为 "sent" 的条目，调用 `twitter show <tweetId>` 检查是否有新回复
    - 如果发现对方回复了，将 status 更新为 "replied"
  - 新增 `getFollowUpTweets()` 函数：返回所有 status 为 "replied" 的待跟进对话
- [ ] **新增 `replyflow_followups` tool**
  - 查看待跟进的对话列表
  - 参数：无
  - 返回：需要跟进的对话列表（原始帖子 + 对方的回复）
- [ ] **更新 `replyflow_history`**
  - 返回中增加 `status` 字段
  - 支持按 `status` 过滤
- [ ] **更新 `replyflow_copy`**
  - 记录时保存 `conversationId` 和 `inReplyToTweetId`
- [ ] **写测试**

## 产出标准

- [ ] `npm test` 全部通过
- [ ] 回复后能检测到对方的新回复
- [ ] `replyflow_followups` 返回需要跟进的对话
- [ ] 跟进后状态正确更新

## 依赖

- ticket-0011（项目中心化搜索）
