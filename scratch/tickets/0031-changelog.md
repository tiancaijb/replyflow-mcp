# ticket-0031: Changelog 自动化

## 目标

用 standard-version 自动生成 CHANGELOG.md。

## 任务

- [ ] 安装 `standard-version`
- [ ] `.versionrc` 配置
- [ ] `package.json` 添加 `release` 脚本
- [ ] 生成初始 CHANGELOG.md（从已有 commit 历史）
- [ ] CI 中发布时自动更新 changelog

## 产出

- `CHANGELOG.md` 存在，包含 Phase 1-3 的所有变更
- `npm run release` 可用
