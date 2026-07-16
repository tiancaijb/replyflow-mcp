# ticket-0023: Husky 提交前检查

## 目标

配置 Husky + lint-staged，在 `git commit` 时自动格式化代码和检查类型。

## 背景

无本地质量门禁，开发者可能在提交有类型错误或 lint 问题的代码后才在 CI 发现。

## 任务清单

- [ ] 安装 Husky + lint-staged（devDependencies）
- [ ] 初始化 Husky：`npx husky init` → 生成 `.husky/pre-commit`
- [ ] 配置 lint-staged 在 `package.json` 中
  - `"*.ts": ["eslint --fix", "prettier --write"]`
- [ ] 更新 `.husky/pre-commit` 内容
  - 运行 `npx lint-staged`
  - 可选运行 `npx tsc --noEmit`（不阻塞 commit，仅 warning）
- [ ] `package.json` 添加 `prepare` 脚本：`"prepare": "husky"`
- [ ] 验证：修改一个 .ts 文件 → `git add` → `git commit` → 自动格式化
- [ ] `.husky/` 目录应提交到 git

## 产出标准

- [ ] `git commit` 时自动 lint-staged 格式化
- [ ] `npm test` 全部通过
- [ ] `npm run build` 通过

## 依赖

- ticket-0022（ESLint + Prettier）— lint-staged 依赖 ESLint 和 Prettier 已配置
