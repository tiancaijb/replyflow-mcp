# ticket-0017: setup.ts 测试覆盖

## 目标

为交互式配置流程 `src/setup.ts` 添加完整的 Vitest 单元测试。

## 背景

`npx replyflow-mcp setup` 是用户首次使用时的入口，包含 6 步 CLI 引导流程。
当前测试覆盖为 0，容易遗漏边界情况。

## 任务清单

- [ ] 创建 `tests/setup.test.ts`
  - 使用 `vi.mock('node:readline/promises')` 模拟 readline
  - 控制 `rl.question` 的返回值序列来模拟用户输入
- [ ] 测试各个步骤函数
  - `stepProjectName`：空输入 → return false；输入 "MyApp" → return "MyApp"
  - `stepProjectDescription` / `stepProjectUrl`：正常输入路径
  - `stepKeywords`：空输入 → 默认值；输入 "a, b, c" → ["a", "b", "c"]
  - `stepReplyStyle`：1-5 对应各风格；无效输入 → 兜底到 curious
- [ ] 测试完整流程 `runInteractiveSetup`
  - 正常路径：6 步骤全部输入 → `updateEffectiveConfig` 被调用 ×1
  - 取消路径（project name 为空）：→ 不保存，返回 false
  - 取消路径（confirm 输入 n）：→ 不保存，返回 false
- [ ] 测试语言步骤
  - 空字符串 → language 为 undefined
  - 输入 "中文" → config.language = "中文"
- [ ] 测试 printSaveSummary / printWelcome 不报错

## 产出标准

- [ ] `npm test` 全部通过
- [ ] 不修改 `src/setup.ts` 生产代码
- [ ] 测试覆盖 setup.ts 的 all 函数和主要分支

## 依赖

- 无（独立任务）
