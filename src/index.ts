#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getConfig,
  checkCredentials,
  resolveTwitterApiKey,
  resolveTwitterApiSecret,
} from "./config.js";
import { list } from "./twitter.js";

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

server.tool(
  "replyflow_generate",
  {
    tweetId: z.string().describe("ID of the tweet to reply to"),
    style: z
      .enum(["casual", "helpful", "professional"])
      .optional()
      .describe("Reply style"),
  },
  async (args) => {
    return withErrorHandling(async () => {
      const config = getConfig();
      resolveTwitterApiKey(config);
      resolveTwitterApiSecret(config);

      // TODO (MVP+): Fetch tweet context via Twitter API v2, then call LLM
      //   to generate 2-3 reply drafts per the user's style preference.

      const style = args.style ?? config.preferredStyle ?? "casual";

      const DRAFTS: Record<string, string[]> = {
        casual: [
          `Interesting take! I've been going back and forth on this too.`,
          `Oh nice, love seeing real numbers instead of just theory.`,
          `Curious — what made you decide to go with this approach?`,
        ],
        helpful: [
          `Great point! One thing that helped me was keeping a daily log of changes. Worth trying!`,
          `If you haven't already, consider adding a simple validation step — catches edge cases early.`,
          `I wrote about a similar challenge here: [link]. The key insight was separating concerns early.`,
        ],
        professional: [
          `Insightful analysis. The data clearly supports the thesis that incremental adoption yields better outcomes.`,
          `I'd add that team alignment on the core metrics is a prerequisite for this approach to work.`,
          `Appreciate you sharing these findings. Have you considered the implications for resource allocation?`,
        ],
      };

      const drafts = DRAFTS[style] ?? DRAFTS.casual;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              tweetId: args.tweetId,
              style,
              drafts,
            }),
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
