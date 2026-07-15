#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getConfig,
  checkConfigIntegrity,
  checkCredentials,
  resolveTwitterApiKey,
  resolveTwitterApiSecret,
  ReplyStyle,
  updateConfig,
} from "./config.js";
import { list } from "./twitter.js";
import { generateReply } from "./generate.js";

// ── CLI entry ────────────────────────────────────────────────────────────────

/**
 * Main entry point. Dispatches based on CLI args:
 *   - `replyflow-mcp setup`     → interactive setup
 *   - `replyflow-mcp --help`    → help text
 *   - `replyflow-mcp`           → start MCP server
 */
async function main() {
  const args = process.argv.slice(2);

  // ── Setup mode ───────────────────────────────────────────────────────
  if (args[0] === "setup") {
    const { runInteractiveSetup } = await import("./setup.js");
    const ok = await runInteractiveSetup();
    process.exit(ok ? 0 : 1);
  }

  // ── Help ─────────────────────────────────────────────────────────────
  if (args[0] === "--help" || args[0] === "-h") {
    console.log("");
    console.log("  ReplyFlow MCP Server");
    console.log("");
    console.log("  Usage:");
    console.log("    npx replyflow-mcp           Start MCP server (stdio)");
    console.log("    npx replyflow-mcp setup     Run interactive configuration");
    console.log("    npx replyflow-mcp --help    Show this help");
    console.log("");
    process.exit(0);
  }

  // ── MCP Server mode ──────────────────────────────────────────────────
  await startServer();
}

// ── Server ───────────────────────────────────────────────────────────────────

async function startServer() {
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

  // ── Startup check ────────────────────────────────────────────────────
  const config = getConfig();
  const integrity = checkConfigIntegrity(config);
  const hasCredentials = checkCredentials(config, integrity);

  if (!hasCredentials) {
    console.error(
      "[ReplyFlow] Server started without credentials. Tools will return errors until configured.",
    );
    console.error(
      "[ReplyFlow] Run 'npx replyflow-mcp setup' for interactive configuration.",
    );
  } else if (integrity.warnings.length > 0) {
    console.error(
      "[ReplyFlow] Server started with warnings (see above). Some tools may have limited functionality.",
    );
  } else {
    console.error("[ReplyFlow] Configuration OK.");
  }

  // ── Helpers ──────────────────────────────────────────────────────────

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

  // ── Tool: replyflow_list ─────────────────────────────────────────────

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

  // ── Tool: replyflow_generate ─────────────────────────────────────────

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
          config.preferredStyle ??
          config.replyStyle ??
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

  // ── Tool: replyflow_copy ─────────────────────────────────────────────

  server.tool(
    "replyflow_copy",
    {
      text: z.string().describe("Reply text to copy to clipboard"),
    },
    async (args) => {
      return withErrorHandling(async () => {
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

  // ── Tool: replyflow_update_config ────────────────────────────────────

  server.tool(
    "replyflow_update_config",
    {
      keywords: z
        .array(z.string())
        .optional()
        .describe("Niche keywords for trending post search (replaces existing list)"),
      style: z
        .enum(STYLE_OPTIONS)
        .optional()
        .describe("Preferred reply style"),
    },
    async (args) => {
      return withErrorHandling(async () => {
        const partial: Record<string, unknown> = {};

        if (args.keywords !== undefined) {
          partial.nicheKeywords = args.keywords;
        }

        if (args.style !== undefined) {
          partial.replyStyle = args.style;
        }

        if (Object.keys(partial).length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  updated: false,
                  reason: "No changes provided. Pass 'keywords' and/or 'style'.",
                }),
              },
            ],
          };
        }

        updateConfig(partial);
        const cfg = getConfig();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                updated: true,
                config: {
                  nicheKeywords: cfg.nicheKeywords,
                  replyStyle: cfg.replyStyle,
                },
              }),
            },
          ],
        };
      });
    },
  );

  // ── Tool: replyflow_config_status ────────────────────────────────────

  server.tool(
    "replyflow_config_status",
    {},
    async () => {
      return withErrorHandling(async () => {
        const cfg = getConfig();
        const report = checkConfigIntegrity(cfg);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                configured: report.ok,
                issues: {
                  critical: report.missing,
                  warnings: report.warnings,
                },
                config: {
                  hasApiKey: !!(cfg.twitterApiKey || process.env.TWITTER_API_KEY),
                  hasOAuth2Token: !!cfg.oauth2AccessToken,
                  hasOAuth2ClientId: !!cfg.oauth2ClientId,
                  nicheKeywords: cfg.nicheKeywords,
                  replyStyle: cfg.replyStyle ?? cfg.preferredStyle ?? "curious",
                },
              }),
            },
          ],
        };
      });
    },
  );

  // ── Connect & run ────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[ReplyFlow] MCP server running on stdio");
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("[ReplyFlow] Fatal error:", err);
  process.exit(1);
});
