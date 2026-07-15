# ticket-0011: 项目中心化搜索 + 项目信息配置

## 目标

将 ReplyFlow 从"管理回复"重定位为"帮独立开发者找到相关讨论并自然地推广项目"。
核心变化：只按 niche 关键词搜索，不再拉 timeline；支持多项目配置和切换。

## 背景

用户的核心场景是：在 Twitter 上找到跟自己项目相关的讨论，自然地参与交流。
现有功能（timeline + mentions）对此没有帮助，应该聚焦于 niche 搜索。

## 任务清单

- [ ] **更新 SPEC.md** — 重新定位产品描述
- [ ] **更新 `src/config.ts`**
  - 新增 `Project` 接口：`{ name: string, description: string, url: string, keywords: string[] }`
  - 新增 `activeProject` 字段（当前激活的项目名）
  - 配置中支持多项目：`projects: Record<string, Project>`
  - 更新 `getEffectiveConfig()` 和 `getConfig()` 以支持项目配置
- [ ] **更新 `src/twitter.ts`**
  - 移除 `getTimeline()`、`getMentions()` 函数（不再需要）
  - 修改 `list()` 函数：只做 niche 搜索，不再拉取 timeline/mentions
  - 合并搜索结果按互动量排序
  - 搜索词优先使用当前激活项目的 keywords
- [ ] **更新 `src/index.ts`**
  - `replyflow_list` 移除 `filter` 参数（不再需要）
  - 新增可选参数 `project`（指定项目名，覆盖当前激活项目）
  - `replyflow_update_config` 支持设置 `project` 字段
  - `replyflow_config_status` 返回当前项目信息
- [ ] **更新 `src/setup.ts`**
  - 简化配置流程：只保留项目信息和关键词
  - 移除多账号相关步骤
- [ ] **更新 README** — 同步文档
- [ ] **清理测试** — 更新 `tests/twitter.test.ts`（移除 timeline/mentions 相关测试，保留 mergeAndSort）

## 产出标准

- [ ] `npm test` 全部通过
- [ ] `npm run build` 编译通过
- [ ] `replyflow_list` 只按 niche/project 关键词搜索，返回相关帖子
- [ ] 项目信息可在配置中保存和更新
- [ ] `replyflow_list --project xxx` 切换项目上下文

## 依赖

- ticket-0010（twitter-cli 后端）
