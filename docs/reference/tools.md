# MCP 工具参考

ReplyFlow 提供 7 个 MCP 工具，所有工具通过 stdio 协议通信。

---

## replyflow_list

按项目关键词搜索值得回复的推文。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `project` | string | 否 | 指定项目名，覆盖当前激活项目 |

**返回示例：**

```json
{
  "tweets": [
    {
      "id": "123456789",
      "text": "Just launched my SaaS product!",
      "author": {
        "id": "author-1",
        "name": "Test User",
        "username": "testuser"
      },
      "publicMetrics": {
        "retweetCount": 12,
        "replyCount": 5,
        "likeCount": 42,
        "quoteCount": 2
      },
      "source": "search",
      "replied": false
    }
  ],
  "userId": "my-user-id"
}
```

---

## replyflow_copy

把回复文本复制到剪贴板并记录到历史。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | 是 | 回复文本 |
| `tweetId` | string | 否 | 被回复的推文 ID |
| `style` | enum | 否 | 回复风格 |
| `conversationId` | string | 否 | 会话/线程 ID |
| `inReplyToTweetId` | string | 否 | 被回复的具体推文 ID |

**返回示例：**

```json
{
  "copied": true,
  "length": 120,
  "historyId": 42,
  "status": "sent"
}
```

---

## replyflow_update_config

更新 ReplyFlow 配置。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `project` | string | 否 | 激活或配置的项目名 |
| `projectName` | string | 否 | 项目显示名称 |
| `projectDescription` | string | 否 | 项目描述 |
| `projectUrl` | string | 否 | 项目 URL |
| `projectKeywords` | string[] | 否 | 项目关键词 |
| `language` | string | 否 | 语言 |
| `keywords` | string[] | 否 | 保底关键词 |
| `style` | enum | 否 | 回复风格 |

**返回示例：**

```json
{
  "updated": true,
  "config": {
    "activeProject": "my-saas",
    "activeProjectInfo": { "name": "My SaaS", "description": "..." },
    "nicheKeywords": ["indie dev", "saas"],
    "replyStyle": "curious"
  }
}
```

---

## replyflow_config_status

查看当前配置状态。

**参数：** 无

**返回示例：**

```json
{
  "configured": true,
  "activeAccount": "default",
  "activeProject": "my-saas",
  "projects": { "my-saas": { "name": "My SaaS", ... } },
  "issues": { "critical": [], "warnings": [] },
  "config": {
    "auth": "twitter-cli (browser cookie)",
    "nicheKeywords": ["indie dev", "saas"],
    "replyStyle": "curious"
  }
}
```

---

## replyflow_history

查看回复历史记录。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tweetId` | string | 否 | 按推文 ID 筛选 |
| `limit` | number | 否 | 最大返回数（默认 20） |
| `status` | enum | 否 | 按状态筛选（sent/replied/followed_up） |

**返回示例：**

```json
{
  "entries": [
    {
      "id": 42,
      "tweetId": "123456789",
      "text": "Great work! Keep building.",
      "style": "curious",
      "copiedAt": "2024-07-15T10:30:00.000Z",
      "account": "default",
      "status": "sent"
    }
  ],
  "totalCount": 1
}
```

---

## replyflow_followups

查看和跟进待回复的对话。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `markAsFollowedUp` | number | 否 | 将指定条目标记为已跟进 |

**返回示例：**

```json
{
  "newReplies": 1,
  "newlyReplied": [
    { "id": 42, "tweetId": "123456789", "text": "Good point!" }
  ],
  "followUps": [
    { "id": 42, "tweetId": "123456789", "status": "replied" }
  ],
  "totalFollowUps": 1
}
```

---

## replyflow_switch_account

切换 Twitter 认证账号（仅用于 twitter-cli 认证）。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `account` | string | 是 | 账号名称（如 personal / work） |

**返回示例：**

```json
{
  "switched": true,
  "account": "personal"
}
```
