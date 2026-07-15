# 0008: 首次运行配置 + OAuth

## 目标

用户第一次启动 ReplyFlow 时的交互式配置流程。

## 任务清单

- [ ] 首次启动检测：`~/.replyflow/config.json` 不存在 → 进入设置模式
- [ ] 交互式设置流程（终端交互）：
  1. 欢迎信息
  2. 输入/确认 niche 关键词（默认 "indie dev, saas, build in public, coding, solopreneur"）
  3. 选择回复风格（默认 Curious，可选列表）
  4. **Twitter OAuth 授权**：
     - 生成授权链接
     - 引导用户浏览器打开
     - 监听回调端口接收 token
     - token 存到 config 文件
  5. 确认配置
  6. 生成 `~/.replyflow/config.json`
- [ ] OAuth 实现：
  - 启动本地 HTTP 服务监听回调端口（如 54321）
  - 生成 Twitter OAuth 2.0 PKCE 授权 URL
  - 用户授权后回调到本地端口
  - 交换 code 为 access token
  - 关闭 HTTP 服务
- [ ] 配置更新 tool（给 agent 调用）：
  - `replyflow_update_config` — 更新关键词或风格
  - 参数：`{ keywords?: string[], style?: string }`
- [ ] 配置完整性检查：每次启动检查必要字段是否存在，缺失时提示

## 产出标准

- 首次运行完整走通配置流程
- OAuth 授权成功后 token 持久化到本地
- `~/.replyflow/config.json` 包含 keywords、style、oauth_token
- 后续启动不再重复配置流程
- Agent 可通过 tool 修改配置

## 依赖

Ticket #0001（需要 config 模块）
