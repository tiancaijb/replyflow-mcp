# ticket-0022: ESLint + Prettier

## 目标

为项目配置 ESLint（flat config）和 Prettier，统一代码风格，CI 中检查格式。

## 背景

项目无代码风格工具，不同开发者提交风格不一致。CI 缺少代码质量检查。

## 任务清单

- [ ] ESLint flat config
  - 创建 `eslint.config.js`（ESLint v9+ flat config）
  - 使用 `@eslint/js` + `typescript-eslint`
  - 配置 TypeScript 规则：`@typescript-eslint/no-unused-vars`、`@typescript-eslint/prefer-optional-chain` 等
  - 配置 `ignores: ["dist/", "node_modules/"]`
- [ ] Prettier 配置
  - 创建 `.prettierrc`（singleQuote, tabWidth 2, semi, trailingComma all）
  - 创建 `.prettierignore`（dist/、node_modules/、docs/）
- [ ] package.json 脚本
  - `lint`：`eslint .`
  - `format`：`prettier --write .`
  - `format:check`：`prettier --check .`
- [ ] CI workflow 增加 lint 步骤
  - 在 `ci.yml` 的 `test` job 中增加 `npm run lint`（或独立 job）
- [ ] 安装 devDependencies
  - `eslint`、`@eslint/js`、`typescript-eslint`、`prettier`
- [ ] 首次运行 `npm run format` 格式化所有文件
- [ ] 首次运行 `npm run lint` 修复所有问题

## 产出标准

- [ ] `npm run lint` 通过（exit 0）
- [ ] `npm run format` 格式化全部文件无报错
- [ ] `npm test` 全部通过
- [ ] `npm run build` 通过

## 依赖

- 无（独立任务）
