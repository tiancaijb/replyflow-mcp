# ticket-0018: npm 自动发布 CI/CD

## 目标

为项目添加 GitHub Actions CI 和自动发布到 npm 的工作流。

## 背景

项目已配置 `package.json`（bin, files, MIT license），
当前 CI 仅有基本测试（`"test": "vitest run"`），缺少自动发布流程。

## 任务清单

- [ ] 创建 `.github/workflows/ci.yml`
  - 触发：push（所有分支）和 pull_request
  - job：`test`
    - matrix：node 18 / 20 / 22
    - steps：checkout → setup-node → npm ci → npm test → npm run build
  - job：`build`（验证构建产物）
    - steps：checkout → setup-node → npm ci → npm run build
  - 分离 test 和 build 为独立 job（并行）
- [ ] 创建 `.github/workflows/publish.yml`
  - 触发：push tag `v*`
  - job：`publish`
    - steps：checkout → setup-node → npm ci → npm test → npm run build → npm publish
    - 使用 `secrets.NPM_TOKEN` 进行 npm 认证
    - 添加 `NODE_AUTH_TOKEN` 环境变量
- [ ] 更新 `package.json`
  - 添加 `publishConfig.access: "public"`
  - 添加 `publishConfig.registry: "https://registry.npmjs.org/"`
  - 确认 `files` 字段包含 `dist/` 和 `README.md`
- [ ] 创建 `.npmignore`（或确认 `files` 字段足够）
  - 排除：`src/`, `tests/`, `scratch/`, `scripts/`, `CONTEXT.md`, `vitest.config.ts`, `tsconfig.json`
- [ ] 添加 `prepublishOnly` 脚本（已有 `"prepublishOnly": "npm run build"` 确认可用）
- [ ] CI 中 cache node_modules 加速

## 产出标准

- [ ] `.github/workflows/ci.yml` 和 `.github/workflows/publish.yml` 存在且语法正确
- [ ] `package.json` publishConfig 配置完整
- [ ] `npm test` 和 `npm run build` 通过
- [ ] 不修改生产代码

## 依赖

- 无（独立任务）
