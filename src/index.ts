#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getEffectiveConfig,
  checkConfigIntegrity,
  checkCredentials,
  updateEffectiveConfig,
  getActiveAccount,
  setActiveAccount,
} from "./config.js";
import { list, resetClient } from "./twitter.js";
import { appendHistory, readHistory, getRepliedTweetIds } from "./history.js";

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
    // Parse --account flag: `npx replyflow-mcp setup --account myaccount`
    const accountIdx = args.indexOf("--account");
    const account = accountIdx >= 0 && args[accountIdx + 1] ? args[accountIdx + 1] : undefined;
    const ok = await runInteractiveSetup(account);
    process.exit(ok ? 0 : 1);
  }

  // ── Help ─────────────────────────────────────────────────────────────
  if (args[0] === "--help" || args[0] === "-h") {
    console.log("");
    console.log("  ReplyFlow MCP Server");
    console.log("");
    console.log("  Usage:");
    console.log("    npx replyflow-mcp                        Start MCP server (stdio)");
    console.log("    npx replyflow-mcp setup                  Run interactive configuration");
    console.log("    npx replyflow-mcp setup --account NAME   Configure a specific account");
    console.log("    npx replyflow-mcp --help                 Show this help");
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
  const config = getEffectiveConfig();
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
        const config = getEffectiveConfig();
        const result = await list(config, args.filter);

        // Mark tweets that have been replied to
        const repliedIds = getRepliedTweetIds();
        if (result.tweets && repliedIds.size > 0) {
          for (const tweet of result.tweets) {
            if (repliedIds.has(tweet.id)) {
              tweet.replied = true;
            }
          }
        }

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

  const STYLE_OPTIONS = ["casual", "curious", "supportive", "thoughtful", "auto"] as const;

  server.tool(
    "replyflow_copy",
    {
      text: z.string().describe("Reply text to copy to clipboard"),
      tweetId: z
        .string()
        .optional()
        .describe("ID of the tweet being replied to (recorded in history)"),
      style: z
        .enum(STYLE_OPTIONS)
        .optional()
        .describe("Reply style used (recorded in history)"),
    },
    async (args) => {
      return withErrorHandling(async () => {
        const account = getActiveAccount() || "default";
        const entry = appendHistory(args.text, args.tweetId, args.style, account);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                copied: true,
                length: args.text.length,
                historyId: entry.id,
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

        updateEffectiveConfig(partial);
        const cfg = getEffectiveConfig();

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
        const cfg = getEffectiveConfig();
        const activeAccount = getActiveAccount();
        const report = checkConfigIntegrity(cfg);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                configured: report.ok,
                activeAccount: activeAccount || "default",
                issues: {
                  critical: report.missing,
                  warnings: report.warnings,
                },
                config: {
                  auth: "twitter-cli (browser cookie)",
                  nicheKeywords: cfg.nicheKeywords,
                  replyStyle: cfg.replyStyle ?? "curious",
                },
              }),
            },
          ],
        };
      });
    },
  );

  // ── Tool: replyflow_switch_account ───────────────────────────────────

  server.tool(
    "replyflow_switch_account",
    {
      account: z.string().describe("Account name to switch to (e.g. 'personal', 'work')"),
    },
    async (args) => {
      return withErrorHandling(async () => {
        setActiveAccount(args.account);

        // Reset Twitter client cache so next call picks up new account's identity
        resetClient();

        // Verify the switch by re-reading
        const switchedTo = getActiveAccount();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                switched: true,
                account: switchedTo,
                message: `Switched to account: ${switchedTo}. All subsequent tool calls will use this account's configuration.`,
              }),
            },
          ],
        };
      });
    },
  );

  // ── Tool: replyflow_history ───────────────────────────────────────────

  server.tool(
    "replyflow_history",
    {
      tweetId: z
        .string()
        .optional()
        .describe("Filter by tweet ID"),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of entries to return (default: 20)"),
    },
    async (args) => {
      return withErrorHandling(async () => {
        const entries = readHistory(args.tweetId, args.limit ?? 20);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ entries }),
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
