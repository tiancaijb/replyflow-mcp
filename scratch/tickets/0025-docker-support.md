# ticket-0025: Docker 支持

## 目标

为项目添加 Dockerfile 多阶段构建和 docker-compose 示例。

## 背景

部分用户希望容器化部署 MCP Server，避免全局安装 Node.js 和 Python。

## 任务清单

- [ ] 创建 `Dockerfile`
  - 多阶段构建
  - Build 阶段：`node:22-alpine` → npm ci → npm run build
  - Production 阶段：`node:22-alpine` → 从 build 阶段复制 dist/ 和 node_modules/
  - 暴露 stdio 端口（仅文档提及，MCP 用 stdio）
  - CMD：`node dist/index.js`
- [ ] 创建 `.dockerignore`
  - 排除：`node_modules/`、`dist/`（build 阶段重建）、`src/`（构建后不需要）、`tests/`、`docs/`、`.git/`、`scratch/` 等
- [ ] 创建 `docker-compose.yml`
  - 定义 replyflow 服务
  - 挂载 `~/.replyflow` 作为 volume 保留配置
  - 环境变量示例：`LOG_LEVEL=info`
- [ ] 更新 README.md
  - 新增「Docker」章节
  - 示例：`docker build -t replyflow-mcp . && docker run -i --rm replyflow-mcp`

## 产出标准

- [ ] `Dockerfile` 存在，构建通过（`docker build -t replyflow-mcp .`）
- [ ] `.dockerignore` 排除正确（镜像不包含测试/源文件）
- [ ] `npm test` 全部通过

## 依赖

- 无（独立任务）
