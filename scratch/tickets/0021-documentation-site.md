# ticket-0021: 文档站 / 使用指南

## 目标

搭建基于 Vitepress 的文档站，部署到 GitHub Pages，提供完整的安装、配置和使用指南。

## 背景

项目已开源（MIT），README.md 包含基本用法。但缺少独立的文档站、
多 MCP 客户端配置示例、操作截图和详细工具参考。

## 任务清单

- [ ] 初始化 Vitepress
  - 在 `docs/` 目录创建 Vitepress 项目
  - 配置 `docs/.vitepress/config.ts`（站点标题、描述、主题配置）
  - 使用中文为主，关键词和 CLI 示例保持英文
- [ ] 文档页面结构
  - `index.md` — 首页介绍（hero + features 布局）
  - `guide/installation.md` — 安装指南（npm install / npx）
  - `guide/configuration.md` — 配置说明（setup 命令 / 手动配置 / 多项目）
  - `guide/usage.md` — 使用指南（基本流程 + 最佳实践）
  - `reference/tools.md` — MCP 工具参考（7 个工具的详细说明、参数、示例输出）
  - `guide/client-setup.md` — 客户端配置（Claude Code / Cursor / pi-agent / Windsurf）
  - `faq.md` — 常见问题
- [ ] 客户端配置示例
  - Claude Code：`claude_desktop_config.json` 示例
  - Cursor：`.cursor/mcp.json` 示例
  - pi-agent：`~/.pi/agent/config.yaml` 示例
  - Windsurf：配置示例
- [ ] 操作截图 / GIF
  - 添加截图 placeholder 或使用代码块模拟
  - 每个工具页包含 JSON 输出示例
- [ ] GitHub Actions 自动部署
  - 创建 `.github/workflows/docs.yml`
  - 触发：push 到 `main` 分支且修改 `docs/` 目录
  - 使用 `peaceiris/actions-gh-pages` 或 vitepress 部署指南
  - 部署到 GitHub Pages
- [ ] 更新 README.md
  - 顶部添加「📖 文档站」badge 链接
  - 底部添加文档站链接

## 产出标准

- [ ] `docs/` 目录存在，Vitepress 构建通过
- [ ] `npm run docs:dev` 可本地预览
- [ ] 文档覆盖 8 个页面以上
- [ ] 每个 MCP tool 有独立文档页，含参数说明和 JSON 示例
- [ ] 4 种 MCP 客户端配置示例齐全
- [ ] GitHub Actions 自动部署到 GitHub Pages

## 依赖

- 无（独立任务）
