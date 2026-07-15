# ticket-0006: 添加 Vitest 测试覆盖

## 目标

为 replyflow-mcp 引入 Vitest 测试框架，覆盖所有核心模块。

## 背景

项目目前没有测试（`"test": "echo no test specified"`），代码质量靠手动验证。
加测试后可以安全重构、防止回归，也为后续开源做准备。

## 任务清单

- [ ] 安装 Vitest 作为 devDependency
- [ ] 创建 `vitest.config.ts`（node 环境，globals 开启）
- [ ] 在 `package.json` 中添加 `test` 和 `test:watch` 脚本
- [ ] 为 `src/config.ts` 写单元测试（`tests/config.test.ts`）
  - `getConfig`：文件不存在返回默认、存在时读取、解析错误回退
  - `updateConfig`：合并写入、只更新部分字段
  - `checkConfigIntegrity`：缺少 API Key 报错、完整配置通过、缺少 LLM Key 警告
  - resolve helpers：env 优先于 config、throw 逻辑
  - `getNicheKeywords` / `getReplyStyle`：默认值回退
- [ ] 为 `src/twitter.ts` 写测试（`tests/twitter.test.ts`）
  - `mergeAndSort`：合并去重、按交互分排序、无 metrics 兜底、空输入
- [ ] 为 `src/generate.ts` 写测试（`tests/generate.test.ts`）
  - `detectStyle`：问题→curious、失败→supportive、长文→thoughtful、默认→casual
  - `extractJson`：从 markdown fence 和纯文本提取 JSON
  - `parseDrafts`：解析、超 280 字符过滤、string 格式兼容
  - `buildSystemPrompt`：各风格指令、auto 检测、对话上下文
  - `detectProvider`：优先 Anthropic、fallback OpenAI、无 Key 抛错

## 产出标准

- [ ] `npm test` 全部通过（exit code 0）
- [ ] 不修改 `src/` 下的生产代码（测试代码独立于源码）

## 依赖

- 无（独立任务，不依赖其他 ticket）
