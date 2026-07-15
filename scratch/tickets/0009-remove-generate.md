# ticket-0009: 移除 replyflow_generate

## 目标

删除 `replyflow_generate` tool 及相关 LLM 依赖。Agent 自己回复就行，MCP 不需要内置生成功能。

## 背景

ReplyFlow 是开源 MCP 工具，目标用户是开发者。Agent（如 pi、Cursor、Claude Code）自己就有回复生成能力，MCP 不需要自带 LLM 调用。去掉后可简化配置、减少依赖。

## 任务清单

- [ ] **删除 `src/generate.ts`** — 整个文件
- [ ] **修改 `src/config.ts`** — 删除 `anthropicApiKey`、`openaiApiKey`、`ReplyStyle` 类型及其相关函数（`resolveAnthropicApiKey`、`resolveOpenAiApiKey`、`getReplyStyle`），清理 `checkConfigIntegrity` 中的 LLM 相关警告
- [ ] **修改 `src/setup.ts`** — 删掉 Step 5（LLM API Key 步骤）
- [ ] **修改 `src/index.ts`** — 删掉 `replyflow_generate` tool 注册和 `generate.ts` 的 import
- [ ] **修改 `scratch/SPEC.md`** — 同步更新
- [ ] **清理测试** — 删掉 `tests/generate.test.ts`，更新 `tests/config.test.ts`（去除 LLM 相关测试和 env var 清理）
- [ ] **更新 README.md** — 移除 generate 相关说明

## 产出标准

- [ ] `npm run build` 编译通过（无 `generate.ts` 引用错误）
- [ ] `npm test` 全部通过
- [ ] `npx replyflow-mcp` 启动正常，`replyflow_generate` 不再出现
- [ ] `npx replyflow-mcp setup` 不再询问 LLM Key

## 依赖

- 无
