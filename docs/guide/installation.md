# 安装指南

## 前提条件

- **Node.js** 18+
- **twitter-cli**：ReplyFlow 使用 [twitter-cli](https://github.com/tiancaijb/twitter-cli) 获取 Twitter 数据

```bash
pip3 install twitter-cli
twitter status
# 在打开的浏览器中登录 Twitter → 命令行显示用户信息即成功
```

## 安装 ReplyFlow

### 方式一：npx（推荐，无需安装）

```bash
npx replyflow-mcp --help
```

### 方式二：全局安装

```bash
npm install -g replyflow-mcp
replyflow-mcp --help
```

### 方式三：项目内安装

```bash
npm install replyflow-mcp
npx replyflow-mcp --help
```

## 首次配置

运行交互式配置向导：

```bash
npx replyflow-mcp setup
```

按照提示输入项目名称、描述、URL 和关键词即可。

## 启动 MCP Server

```bash
npx replyflow-mcp
```

服务器在 stdio 上等待 MCP 客户端连接。
