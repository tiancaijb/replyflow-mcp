# 使用指南

## 基本工作流

### 1. 搜索值得回复的推文

AI Agent 调用 `replyflow_list` 工具，根据项目关键词搜索相关讨论：

```json
// replyflow_list 返回示例
{
  "tweets": [
    {
      "id": "123456789",
      "text": "Just launched my new SaaS!",
      "author": { "name": "Dev User", "username": "devuser" },
      "publicMetrics": { "likeCount": 42, "replyCount": 5 }
    }
  ],
  "userId": "my-user-id"
}
```

### 2. AI 生成回复

根据推文内容，选择回复风格（curious / casual / supportive / thoughtful / auto）。

### 3. 复制回复

调用 `replyflow_copy` 工具复制回复并记录历史：

```json
// replyflow_copy 返回示例
{
  "copied": true,
  "length": 120,
  "historyId": 42,
  "status": "sent"
}
```

### 4. 粘贴 → 发布

用户手动粘贴到 Twitter 并发布。ReplyFlow 不接入 Twitter Write API。

## 跟进流程

### 查看待跟进对话

调用 `replyflow_followups` 检查已回复的推文是否有新回复：

```json
// replyflow_followups 返回示例
{
  "newReplies": 2,
  "newlyReplied": [
    { "id": 42, "tweetId": "123", "text": "Great point!" }
  ],
  "followUps": [...]
}
```

### 标记已跟进

调用 `replyflow_followups markAsFollowedUp: 42` 标记已处理。

## 最佳实践

1. **关键词要精准** — 太宽泛会搜到无关内容，太窄会错过机会
2. **回复要自然** — 先提供价值，再自然带出项目
3. **定期跟进** — 启用自动跟进检查（followupInterval）不错过互动
4. **多项目切换** — 如果你有多个项目，用多项目配置管理不同上下文
