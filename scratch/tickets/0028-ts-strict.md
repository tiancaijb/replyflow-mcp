# ticket-0028: TypeScript 严格选项强化

## 目标

启用更细粒度的 TypeScript 严格选项，提升类型安全性。

## 背景

当前 `tsconfig.json` 有 `strict: true`，但 `strict` 不包含 `noUncheckedIndexedAccess`。

## 任务清单

- [ ] 启用 `noUncheckedIndexedAccess`
  - 在 `tsconfig.json` 的 `compilerOptions` 中添加
  - 修复所有新增的类型错误（主要是数组/对象索引访问变为 `T | undefined`）
  - 重点关注：`src/config.ts`（projects 索引）、`src/history.ts`（entries 索引）、`src/twitter.ts`（data 索引）
- [ ] 代码修改模式
  - 使用类型守卫 `if (item !== undefined)` 而不是 `!` 非空断言
  - 仅在明确知道不会为 undefined 时使用 `!`（如数组长度检查后）
  - 对象属性访问使用可选链 `?.` 简化
- [ ] 验证
  - `npm run build` 通过
  - `npm test` 全部通过
  - 不改变运行时行为

## 产出标准

- [ ] `noUncheckedIndexedAccess` 启用
- [ ] `npm run build` 通过（exit 0）
- [ ] `npm test` 全部通过
- [ ] 非空断言（`!`）使用有注释说明原因

## 依赖

- 无（独立任务，但建议在 ESLint + Prettier 之后）
