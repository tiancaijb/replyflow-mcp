# ticket-0034: 构建优化

## 目标

检查打包产物，优化 tree-shaking。

## 任务

- [ ] 检查 `dist/index.js` 中的死代码
- [ ] 确认 `package.json` 的 `files` 字段正确
- [ ] 检查是否有未使用的依赖
- [ ] 考虑 `tsc` 替代方案（tsup / esbuild）加速构建

## 产出

- 构建产物大小不变或更小
- 构建速度不慢于当前
