# ticket-0007: 回复历史管理

## 目标

为 ReplyFlow 添加回复历史记录功能：自动记录已复制的回复、标记帖子"已回"、支持查询历史。

## 背景

用户复制回复后无法追踪发了什么，也没有"已回"标记容易重复处理同一个帖子。
需要本地持久化历史记录，并对现有工具做相应改造。

## 任务清单

- [ ] **存储**：创建 `~/.replyflow/history.json`（JSON 数组），每条记录包含：
  - `id`：自增唯一 ID
  - `tweetId`：回复的帖子 ID
  - `text`：回复内容
  - `style`：使用的回复风格
  - `copiedAt`：ISO 时间戳
  - `account`：当前账号名称（默认 "default"）
- [ ] **改造 `replyflow_copy`**：调用时自动写入 history.json
  - 返回内容增加 `historyId` 字段
- [ ] **改造 `replyflow_list`**：查询历史，匹配已回帖子的 ID，在返回数据中标记 `replied: true`
  - 不过滤，只标记
- [ ] **新增 `replyflow_history` tool**：
  - 参数：`tweetId`（可选，按帖子 ID 查）、`limit`（可选，默认 20，最近 N 条）
  - 返回：历史记录数组
- [ ] **跨平台**：使用 `node:path` 和 `os.homedir()` 保证路径跨平台兼容
  - 所有文件操作统一用 `path.join(homedir(), ".replyflow", ...)` 模式
- [ ] **写测试**：
  - `tests/history.test.ts`：记录写入、已回标记、查询功能
  - 用 `vi.mock("node:fs")` 模拟文件 I/O

## 产出标准

- [ ] `npm test` 全部通过
- [ ] `replyflow_copy` 调用后 history.json 有记录
- [ ] `replyflow_list` 中已回帖子标记 `replied: true`
- [ ] `replyflow_history` 返回正确数据

## 依赖

- 无（可独立实现）
