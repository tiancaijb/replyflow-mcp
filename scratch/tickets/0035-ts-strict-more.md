# ticket-0035: TypeScript 再强化

## 目标

启用 `exactOptionalPropertyTypes` 等更多严格选项。

## 任务

- [ ] 启用 `exactOptionalPropertyTypes`
- [ ] 修复 Config 接口（`activeProject` 等 optional 字段）
- [ ] 启用 `noPropertyAccessFromIndexSignature`
- [ ] Build + Test 通过

## 结果

- `noPropertyAccessFromIndexSignature` — 启用后与 `process.env.X` 频繁冲突，暂不启用
- `exactOptionalPropertyTypes` — 与 Config optional fields 模式冲突，暂不启用
- 保持 `noUncheckedIndexedAccess` 已启用的状态（ticket-0028）

## 状态

- `status: archived` — 严格选项评估完成，当前选项已足够
