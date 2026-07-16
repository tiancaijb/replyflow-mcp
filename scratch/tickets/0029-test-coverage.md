# ticket-0029: 测试覆盖率报告

## 目标

配置 vitest 覆盖率报告，设置最小覆盖率阈值。

## 任务

- [ ] 安装 `@vitest/coverage-v8`
- [ ] `vitest.config.ts` 配置 coverage: provider v8, thresholds (branches 80, functions 80, lines 80, statements 80)
- [ ] CI 中 `npm test -- --coverage` 运行覆盖率检查
- [ ] 修复当前低于阈值的模块

## 产出

- `npm test -- --coverage` 生成覆盖率报告
- CI 中覆盖率不达标时 warning
