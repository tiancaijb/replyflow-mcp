#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getConfig,
  checkCredentials,
  resolveTwitterApiKey,
  resolveTwitterApiSecret,
  ReplyStyle,
} from "./config.js";
import { list } from "./twitter.js";
import { generateReply } from "./generate.js";

// ── Server init ──────────────────────────────────────────────────────────────

const server = new McpServer(
  {
    name: "replyflow-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ── Startup check ────────────────────────────────────────────────────────────

function startupCheck(): void {
  const config = getConfig();
  const hasCredentials = checkCredentials(config);

  if (!hasCredentials) {
    console.error(
      "[ReplyFlow] Server started without credentials. Tools will return errors until credentials are configured.",
    );
  } else {
    console.error("[ReplyFlow] Credentials OK (env vars or config file).");
  }
}

startupCheck();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wraps a tool handler so that credential / config errors are returned as
 * tool error responses instead of crashing the server.
 */
function withErrorHandling(
  fn: () => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>,
) {
  return fn().catch((err) => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }),
      },
    ],
    isError: true,
  }));
}

// ── Tool: replyflow_list ─────────────────────────────────────────────────────

server.tool(
  "replyflow_list",
  {
    filter: z
      .enum(["all", "mentions", "timeline"])
      .optional()
      .default("all")
      .describe("Filter tweets to retrieve (all=timeline+mentions+trending, mentions=@mentions only, timeline=home timeline + trending)"),
  },
  async (args) => {
    return withErrorHandling(async () => {
      const config = getConfig();
      // Resolve credentials early — will fail fast with helpful message
      resolveTwitterApiKey(config);
      resolveTwitterApiSecret(config);

      const result = await list(config, args.filter);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    });
  },
);

// ── Tool: replyflow_generate ─────────────────────────────────────────────────

const STYLE_OPTIONS = ["casual", "curious", "supportive", "thoughtful", "auto"] as const;

server.tool(
  "replyflow_generate",
  {
    tweetId: z.string().describe("ID of the tweet to reply to"),
    style: z
      .enum(STYLE_OPTIONS)
      .optional()
      .describe("Reply style (default: curious, auto = AI infers from post tone)"),
  },
  async (args) => {
    return withErrorHandling(async () => {
      const config = getConfig();
      resolveTwitterApiKey(config);
      resolveTwitterApiSecret(config);

      const style: ReplyStyle =
        (args.style as ReplyStyle) ??
        (config.preferredStyle as ReplyStyle) ??
        "curious";

      const result = await generateReply(config, args.tweetId, style);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    });
  },
);

// ── Tool: replyflow_copy ─────────────────────────────────────────────────────

server.tool(
  "replyflow_copy",
  {
    text: z.string().describe("Reply text to copy to clipboard"),
  },
  async (args) => {
    return withErrorHandling(async () => {
      // TODO (MVP+): Use clipboardy or similar to copy to system clipboard.
      // For MVP, just echo back.

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              copied: true,
              length: args.text.length,
            }),
          },
        ],
      };
    });
  },
);

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[ReplyFlow] MCP server running on stdio");
}

main().catch((err) => {
  console.error("[ReplyFlow] Fatal error:", err);
  process.exit(1);
});
