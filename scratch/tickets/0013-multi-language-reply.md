# 0013: 多语言回复支持

## 目标

非英语母语的用户能用自己语言写意图，AI 自动检测推文语言生成对应语言的回复，并用用户偏好的语言写说明。

## 背景

独立开发者的用户群体可能遍布全球（英语国家、东南亚等），开发者本人可能不会目标用户的语言。
需要让 AI 代理（pi-agent / Cursor / Claude Code）知道怎么处理多语言回复场景。

## 任务清单

- [ ] **`src/config.ts`** — Config 接口加 `language?: string` 字段（无默认值）
- [ ] **`src/index.ts`** — `replyflow_update_config` 加 `language` 参数；`replyflow_config_status` 展示当前语言
- [ ] **`src/setup.ts`** — 交互式设置流程加语言选择步骤（可选，默认跳过让 AI 自动检测）
- [ ] **`~/.pi/agent/skills/replyflow/SKILL.md`** — 更新技能文档：
  - 移除已不存在的 `replyflow_generate` 引用
  - 适配当前实际 7 个 tool
  - 新增多语言回复工作流说明
  - 说明 AI 应自动检测推文语言、检测用户输入语言并确认后设置
- [ ] **写配置测试**

## 产出标准

- `replyflow_update_config` 可设置 `language`
- `replyflow_config_status` 返回 `config.language`
- SKILL.md 清晰指导 AI 处理多语言回复
- `npm test` 全部通过

## 依赖

无
