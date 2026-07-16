import { defineConfig } from "vitepress";

export default defineConfig({
  title: "ReplyFlow",
  description: "Manage Twitter replies, naturally promote your project",
  lang: "zh-CN",
  base: "/replyflow-mcp/",

  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "指南", link: "/guide/installation" },
      { text: "工具参考", link: "/reference/tools" },
      { text: "FAQ", link: "/faq" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "入门",
          items: [
            { text: "安装指南", link: "/guide/installation" },
            { text: "配置说明", link: "/guide/configuration" },
            { text: "使用指南", link: "/guide/usage" },
            { text: "客户端配置", link: "/guide/client-setup" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "MCP 工具",
          items: [
            { text: "工具概览", link: "/reference/tools" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/tiancaijb/replyflow-mcp" },
    ],

    footer: {
      message: "MIT License — Built for indie developers",
    },
  },
});
