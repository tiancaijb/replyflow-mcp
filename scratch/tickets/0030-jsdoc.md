# ticket-0030: 公共 API JSDoc

## 目标

为所有 `src/*.ts` 的导出函数添加 JSDoc 注释。

## 任务

- [ ] `src/config.ts` — 所有导出函数（getActiveAccount 等 8 个）
- [ ] `src/twitter.ts` — 所有导出类型和函数
- [ ] `src/history.ts` — 所有导出函数
- [ ] `src/logger.ts` — 导出类型和函数
- [ ] `src/cache.ts` — CacheStore 类 + 方法
- [ ] `src/errors.ts` — 错误类
- [ ] `src/setup.ts` — `runInteractiveSetup`
- [ ] `src/index.ts` — 关键导出（无导出，仅 main 函数注释）

## 产出

- 每个导出函数有 `@param`、`@returns`、简要说明
- Build 通过
