# ticket-0019: 集成测试套件

## 目标

搭建集成测试框架，覆盖核心流程的端到端路径，使用 mock CLI 数据。

## 背景

当前 4 个测试文件全部 mock 了文件系统，没有真实调用 twitter-cli 的集成测试。
核心流程（config → twitter list → history → followups）的端到端路径未覆盖。

## 任务清单

- [ ] Mock CLI 机制
  - 环境变量 `REPLYFLOW_MOCK_CLI=true` 开启 mock 模式
  - 在 `src/twitter.ts` 的 `runTwitter()` 中检测环境变量
  - mock 模式下不执行 `spawnSync`，改为从 fixture JSON 文件读取响应
  - Fixture 查找逻辑：`tests/fixtures/{command}.json` 匹配 CLI 命令
- [ ] 测试 Fixture 数据
  - 创建 `tests/fixtures/` 目录
  - `search.json` — `twitter search --json ...` 的模拟响应
  - `whoami.json` — `twitter whoami --json` 的模拟响应
  - `tweet.json` — `twitter tweet --json ...` 的模拟响应
  - 每个 fixture 包含正常响应和错误响应两个版本
- [ ] 创建 `tests/integration/` 目录
  - `tests/integration/config-history.test.ts` — config → history 流程
    - 配置项目 → 搜索推文 → 复制回复 → 查看历史
  - `tests/integration/reply-chain.test.ts` — 回复链追踪流程
    - 回复 → 检查新回复（mock）→ 跟进 → 状态变更
  - `tests/integration/multi-project.test.ts` — 多项目流程
    - 创建多项目 → 切换 → 按项目搜索
- [ ] 分离脚本
  - `package.json` 添加 `test:unit`（vitest run，排除 integration）
  - `package.json` 添加 `test:integration`（vitest run，仅 integration）
  - 使用 vitest 的 `include/exclude` 配置
- [ ] Mock CLI 支持错误模拟
  - 通过 fixture 文件名后缀：`search.timeout.json`, `search.auth-error.json`
  - `runTwitter` 参数中包含 `__error` 参数来选择错误 fixture
  - 或通过环境变量 `REPLYFLOW_MOCK_ERROR=timeout` 控制

## 产出标准

- [ ] `npm run test:unit` 全部通过（不影响现有单元测试）
- [ ] `npm run test:integration` 全部通过（mock 环境）
- [ ] `npm test` 运行所有测试（unit + integration）
- [ ] 不修改现有生产代码逻辑（仅 `runTwitter` 增加 mock 分支）

## 依赖

- ticket-0015（Twitter CLI 健壮性）— runTwitter 的改造是 mock 分支的基础
