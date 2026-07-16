# ticket-0027: 依赖安全审计

## 目标

配置 Dependabot 自动依赖更新 + CI 中运行 npm audit。

## 背景

无自动化依赖安全扫描，`npm audit` 可能发现漏洞而不自知。

## 任务清单

- [ ] 创建 `.github/dependabot.yml`
  - package-ecosystem: npm
  - directory: "/"
  - schedule.interval: weekly
  - 使用 groups 批量 PR（减少噪音）
- [ ] CI 增加安全审计 job
  - 在 `ci.yml` 中新增 `audit` job
  - `npm audit --audit-level=high`
  - 不阻塞构建（`continue-on-error: true`），仅 warning
- [ ] 当前状态检查
  - 运行 `npm audit` 确认无 high/critical 漏洞
  - 如有漏洞，列出并修复（或添加 `overrides`）

## 产出标准

- [ ] `.github/dependabot.yml` 配置正确
- [ ] CI 中安全审计步骤运行
- [ ] 当前 `npm audit` 无 high/critical 漏洞
- [ ] `npm test` 全部通过

## 依赖

- 无（独立任务）
