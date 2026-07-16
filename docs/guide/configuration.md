# 配置说明

## 交互式配置

```bash
npx replyflow-mcp setup
```

按提示依次输入：
1. **项目名称** — 标识项目，用于配置切换
2. **项目描述** — 一句话描述
3. **项目 URL** — 项目链接
4. **关键词** — 用于在 Twitter 搜索相关讨论
5. **回复风格** — 默认回复语气（curious / casual / supportive / thoughtful / auto）
6. **语言** — AI 回复说明的语言（留空则自动检测）

## 手动配置

配置文件位置：`~/.replyflow/config.json`

```json
{
  "activeProject": "my-saas",
  "projects": {
    "my-saas": {
      "name": "My SaaS",
      "description": "AI-powered code review",
      "url": "https://my-saas.com",
      "keywords": ["code review", "ai coding", "developer tools"]
    }
  },
  "replyStyle": "curious",
  "nicheKeywords": ["indie dev", "saas", "build in public"]
}
```

## 多项目配置

`config.json` 支持多个项目，通过 `activeProject` 切换：

```json
{
  "activeProject": "project-a",
  "projects": {
    "project-a": { "name": "Project A", "keywords": ["keyword a"] },
    "project-b": { "name": "Project B", "keywords": ["keyword b"] }
  }
}
```

### 切换项目

```bash
# 通过 replyflow_update_config tool
replyflow_update_config project: "project-b"

# 或直接编辑配置文件
```

## 配置字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `activeProject` | string | 当前激活的项目名 |
| `projects` | object | 项目配置映射 |
| `nicheKeywords` | string[] | 保底关键词（无活跃项目时使用） |
| `replyStyle` | enum | 回复风格 |
| `language` | string | AI 说明语言 |
| `logLevel` | enum | 日志级别（debug/info/warn/error） |
| `cacheTTL` | number | 搜索缓存 TTL（秒） |
| `followupInterval` | number | 自动跟进检查间隔（分钟） |
