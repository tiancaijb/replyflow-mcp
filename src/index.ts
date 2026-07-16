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
import logger from "./logger.js";
import { list, resetClient } from "./twitter.js";
import {
  appendHistory,
  readHistory,
  getRepliedTweetIds,
  checkForReplies,
  getFollowUpTweets,
  updateEntryStatus,
  markAsFollowedUp,
} from "./history.js";
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
    console.log("    npx replyflow-mcp                        Start MCP server (stdio)");
    console.log("    npx replyflow-mcp setup                  Run interactive configuration");
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

  // Apply config logLevel (overrides LOG_LEVEL env var)
  if (config.logLevel) {
    logger.setLevel(config.logLevel);
  }

  if (!hasCredentials) {
    logger.warn(
      "Server started without credentials. Tools will return errors until configured.",
    );
    logger.info(
      "Run 'npx replyflow-mcp setup' for interactive configuration.",
    );
  } else if (integrity.warnings.length > 0) {
    logger.warn(
      "Server started with warnings (see above). Some tools may have limited functionality.",
    );
  } else {
    logger.info("Configuration OK.");
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
      project: z
        .string()
        .optional()
        .describe("Project name to search for (overrides active project)"),
    },
    async (args) => {
      return withErrorHandling(async () => {
        const config = getEffectiveConfig();
        const result = await list(config, args.project);

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
      conversationId: z
        .string()
        .optional()
        .describe("Conversation/thread ID for reply chain tracking"),
      inReplyToTweetId: z
        .string()
        .optional()
        .describe("ID of the tweet this reply is responding to (if different from tweetId)"),
      style: z
        .enum(STYLE_OPTIONS)
        .optional()
        .describe("Reply style used (recorded in history)"),
    },
    async (args) => {
      return withErrorHandling(async () => {
        const account = getActiveAccount() || "default";
        const entry = appendHistory(
          args.text,
          args.tweetId,
          args.style,
          account,
          args.conversationId,
          args.inReplyToTweetId,
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                copied: true,
                length: args.text.length,
                historyId: entry.id,
                status: entry.status,
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
      project: z
        .string()
        .optional()
        .describe("Project name to activate or configure"),
      projectName: z
        .string()
        .optional()
        .describe("Project display name (when creating/updating a project)"),
      projectDescription: z
        .string()
        .optional()
        .describe("Project description (when creating/updating a project)"),
      projectUrl: z
        .string()
        .optional()
        .describe("Project URL (when creating/updating a project)"),
      projectKeywords: z
        .array(z.string())
        .optional()
        .describe("Project keywords (when creating/updating a project)"),
      language: z
        .string()
        .optional()
        .describe("Language for reply explanations (e.g. '中文', 'English', '日本語')"),
      keywords: z
        .array(z.string())
        .optional()
        .describe("Fallback niche keywords (replaces existing list)"),
      style: z
        .enum(STYLE_OPTIONS)
        .optional()
        .describe("Preferred reply style"),
    },
    async (args) => {
      return withErrorHandling(async () => {
        const partial: Record<string, unknown> = {};

        // Handle project creation/update
        if (args.project !== undefined) {
          partial.activeProject = args.project;

          // If project details provided, create/update the project
          if (
            args.projectName !== undefined ||
            args.projectDescription !== undefined ||
            args.projectUrl !== undefined ||
            args.projectKeywords !== undefined
          ) {
            const currentCfg = getEffectiveConfig();
            const currentProject = currentCfg.projects?.[args.project];

            const projects = { ...(currentCfg.projects ?? {}) };
            projects[args.project] = {
              ...(currentProject ?? { name: args.project, description: "", url: "", keywords: [] }),
              ...(args.projectName !== undefined ? { name: args.projectName } : {}),
              ...(args.projectDescription !== undefined ? { description: args.projectDescription } : {}),
              ...(args.projectUrl !== undefined ? { url: args.projectUrl } : {}),
              ...(args.projectKeywords !== undefined ? { keywords: args.projectKeywords } : {}),
            };
            partial.projects = projects;
          }
        }

        if (args.language !== undefined) {
          partial.language = args.language;
        }

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
                  reason: "No changes provided. Pass 'project', 'keywords', and/or 'style'.",
                }),
              },
            ],
          };
        }

        updateEffectiveConfig(partial);
        const cfg = getEffectiveConfig();

        const activeProject = cfg.activeProject
          ? cfg.projects?.[cfg.activeProject]
          : undefined;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                updated: true,
                config: {
                  activeProject: cfg.activeProject ?? null,
                  activeProjectInfo: activeProject ?? null,
                  projects: cfg.projects ?? {},
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

        const activeProject = cfg.activeProject
          ? cfg.projects?.[cfg.activeProject]
          : undefined;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                configured: report.ok,
                activeAccount: activeAccount || "default",
                activeProject: cfg.activeProject ?? null,
                activeProjectInfo: activeProject ?? null,
                projects: cfg.projects ?? {},
                issues: {
                  critical: report.missing,
                  warnings: report.warnings,
                },
                config: {
                  auth: "twitter-cli (browser cookie)",
                  nicheKeywords: cfg.nicheKeywords,
                  replyStyle: cfg.replyStyle ?? "curious",
                  language: cfg.language ?? null,
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
      status: z
        .enum(["sent", "replied", "followed_up"])
        .optional()
        .describe("Filter by reply chain status"),
    },
    async (args) => {
      return withErrorHandling(async () => {
        const entries = readHistory(args.tweetId, args.limit ?? 20, args.status);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                entries,
                totalCount: entries.length,
              }),
            },
          ],
        };
      });
    },
  );

  // ── Tool: replyflow_followups ────────────────────────────────────────

  server.tool(
    "replyflow_followups",
    {
      markAsFollowedUp: z
        .number()
        .optional()
        .describe("Entry ID to mark as followed up (optional, marks a specific entry as done)"),
    },
    async (args) => {
      return withErrorHandling(async () => {
        // If marking a specific entry as followed up
        if (args.markAsFollowedUp !== undefined) {
          const entry = markAsFollowedUp(args.markAsFollowedUp);
          if (!entry) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: `Entry with id ${args.markAsFollowedUp} not found`,
                  }),
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  updated: true,
                  entry: {
                    id: entry.id,
                    tweetId: entry.tweetId,
                    status: entry.status,
                  },
                }),
              },
            ],
          };
        }

        // Check for new replies on all sent entries
        try {
          const newlyReplied = checkForReplies();

          // Get all follow-up tweets (status "replied")
          const followUps = getFollowUpTweets();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  newReplies: newlyReplied.length,
                  newlyReplied: newlyReplied.map((e) => ({
                    id: e.id,
                    tweetId: e.tweetId,
                    text: e.text.slice(0, 100),
                    copiedAt: e.copiedAt,
                  })),
                  followUps: followUps.map((e) => ({
                    id: e.id,
                    tweetId: e.tweetId,
                    conversationId: e.conversationId,
                    inReplyToTweetId: e.inReplyToTweetId,
                    text: e.text.slice(0, 100),
                    copiedAt: e.copiedAt,
                    status: e.status,
                    account: e.account,
                  })),
                  totalFollowUps: followUps.length,
                }),
              },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: err instanceof Error ? err.message : String(err),
                  followUps: getFollowUpTweets().map((e) => ({
                    id: e.id,
                    tweetId: e.tweetId,
                    status: e.status,
                    text: e.text.slice(0, 100),
                  })),
                }),
              },
            ],
          };
        }
      });
    },
  );

  // ── Connect & run ────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("SERVER_STARTED");
  logger.info("MCP server running on stdio");
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

main().catch((err) => {
  logger.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
