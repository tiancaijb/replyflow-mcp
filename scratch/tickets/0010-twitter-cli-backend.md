# ticket-0010: 改用 twitter-cli 作为后端

## 目标

移除 `twitter-api-v2` 依赖，改用 `twitter-cli`（Python CLI 工具）作为数据后端。解决 Twitter API v2 免费层配额不足的问题。

## 背景

Twitter API v2 Essential（免费）层已不再提供搜索和读取额度。`twitter-cli` 使用浏览器 Cookie 认证，不受 API 配额限制，且功能完整（timeline、搜索、回复等）。

## 任务清单

- [ ] **移除 `twitter-api-v2` 依赖** — 从 `package.json` 和 `node_modules` 中删除
- [ ] **重写 `src/twitter.ts`** — 用 `child_process.execSync` 调用 `twitter` CLI 命令替代 Twitter API 调用
  - `getTimeline()` → `twitter feed --json`
  - `getMentions()` → `twitter feed --filter mentions --json`（或 `twitter mentions`）
  - `getTrendingPosts(keywords)` → `twitter search "keywords" --json`
  - `getTweetContext()` → `twitter show <id> --json` + 递归父链
  - `mergeAndSort()` — 保留现有逻辑
  - `list()` — 保留现有接口
  - CLI 输出 JSON 解析
- [ ] **简化 `src/config.ts`** — 移除 `twitterApiKey`、`twitterApiSecret`、OAuth 相关字段
  - 保留 `nicheKeywords`、`replyStyle`、`account` 相关配置
  - 保留多账号支持
  - 更新 `checkConfigIntegrity` — 不再检查 API Key，改为检查 `twitter` CLI 是否可用
- [ ] **简化 `src/setup.ts`** — 移除 API Key/OAuth 步骤，只保留关键词和风格
- [ ] **更新 `src/index.ts`** — 同步修改
- [ ] **清理测试** — 更新 `tests/twitter.test.ts`（保留 `mergeAndSort` 测试），更新 `tests/config.test.ts`、`tests/account.test.ts`
- [ ] **更新 README / SPEC** — 同步文档

## 产出标准

- [ ] `npm test` 全部通过
- [ ] `npm run build` 编译通过（无 `twitter-api-v2` 引用）
- [ ] `npx replyflow-mcp` 启动正常
- [ ] `replyflow_list` 能通过 `twitter` CLI 拉数据
- [ ] `twitter-cli` 命令可用（`twitter --help` 返回 0）

## 依赖

- 需要系统已安装 `twitter-cli`（Python 包，`pip3 install twitter-cli`）
- 用户需已通过浏览器登录 Twitter（Cookie 认证）
