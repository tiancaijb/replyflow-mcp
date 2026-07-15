# 0007: AI 回复生成

## 目标

实现 `replyflow_generate` tool：为帖子生成上下文感知的回复草稿。

## 任务清单

- [ ] 用户提供 LLM API Key（环境变量 `ANTHROPIC_API_KEY` 或 `OPENAI_API_KEY`）
- [ ] 支持 Claude API（优先）和 OpenAI API（备选）
- [ ] 实现回复生成核心逻辑 `generateReply(post, context, style)`：
  - 输入：帖子内容 + 上下文链条 + 回复风格
  - Prompt 设计：
    - 理解帖子+上下文语境
    - 按指定风格生成 2-3 条回复
    - 每条回复附带简短 reason（为什么这样回）
  - 输出：`{ drafts: [{ id, text, reason }] }`
- [ ] 风格系统：
  - Casual / Curious（默认）/ Supportive / Thoughtful / Auto
  - 每种风格对应一组 prompt instructions
  - Auto 模式：AI 根据帖子语气自动匹配
- [ ] 回复质量约束：
  - 长度不超过 280 字符（Twitter 限制）
  - 不能是空话/套话（"Great post!" 这种过滤掉）
  - 优先提问或表达有内容的观点

## 产出标准

- `replyflow_generate` 返回 2-3 条符合风格的回复
- 带上下文时能正确理解语境（不会跑题）
- 每条回复不超过 280 字符
- 无 API Key 时给出清晰引导
- `auto` 模式能正确识别帖子语气

## 依赖

Ticket #0001
