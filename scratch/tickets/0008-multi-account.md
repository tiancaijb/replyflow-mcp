# ticket-0008: 多账号支持

## 目标

为 ReplyFlow 添加多账号切换功能：支持多个 Twitter 账号独立配置，通过 tool 切换。

## 背景

目前只支持单个 Twitter 账号配置在 `~/.replyflow/config.json`。
开发者和团队可能需要管理多个账号（个人号 + 产品号），需要独立配置和灵活切换。

## 任务清单

- [ ] **目录结构**：
  - 默认账号配置保留在 `~/.replyflow/config.json`
  - 其他账号存入 `~/.replyflow/accounts/<account-name>/config.json`
  - 当前激活的账号名记录在 `~/.replyflow/active_account`（纯文本文件）
- [ ] **切换逻辑**：
  - 所有 tool 内部通过 `getEffectiveConfig()` 读取当前账号的配置
  - 如果 `active_account` 有值，从对应 `accounts/<name>/config.json` 读
  - 如果无值或文件不存在，回退到 `~/.replyflow/config.json`
- [ ] **新增 `replyflow_switch_account` tool**：
  - 参数：`account`（账号名称）
  - 行为：写入 `active_account` 文件，重置 Twitter 客户端缓存
  - 如果账号目录不存在，自动创建
- [ ] **曾改 `setup` 命令**：支持指定账号名（`npx replyflow-mcp setup --account myaccount`）
  - 不指定则配置当前激活账号或默认
- [ ] **跨平台**：路径处理统一用 `node:path` + `os.homedir()`
- [ ] **写测试**：
  - `tests/account.test.ts`：切换账号、读取配置、回退默认

## 产出标准

- [ ] `npm test` 全部通过
- [ ] `replyflow_switch_account` 切换后，后续 tool 调用使用新账号配置
- [ ] 切换到不存在的账号时自动创建配置目录
- [ ] 不入侵现有单账号用户的配置结构

## 依赖

- ticket-0007（回复历史中 `account` 字段依赖此 ticket 的账号概念）
