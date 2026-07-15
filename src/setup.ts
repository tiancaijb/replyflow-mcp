/**
 * replyflow-mcp interactive setup.
 *
 * Usage: npx replyflow-mcp setup
 *
 * Walks the user through:
 *   1. Niche keywords for trending-post search
 *   2. Preferred reply style
 *   3. Save to config file
 *
 * No API keys needed — twitter-cli uses browser cookie auth.
 */

import * as readline from "node:readline/promises";
import type { Interface as ReadlineInterface } from "node:readline/promises";
import { stdin as stdinRaw, stdout } from "node:process";
import {
  Config,
  ReplyStyle,
  CONFIG_PATH,
  updateEffectiveConfig,
  setActiveAccount,
  getAccountConfigPath,
} from "./config.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createReader() {
  return readline.createInterface({
    input: stdinRaw,
    output: stdout,
  });
}

async function ask(rl: readline.Interface, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function askWithDefault(
  rl: readline.Interface,
  question: string,
  defaultVal: string,
): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim() || defaultVal;
}

// ── Banners ──────────────────────────────────────────────────────────────────

function printWelcome(): void {
  console.log("");
  console.log("  ╭──────────────────────────────────────────────────────╮");
  console.log("  │                                                      │");
  console.log("  │   🚀 ReplyFlow – Interactive Setup                   │");
  console.log("  │                                                      │");
  console.log("  │   This will configure your niche keywords and        │");
  console.log("  │   preferred reply style in ~/.replyflow/config.json. │");
  console.log("  │                                                      │");
  console.log("  │   ⚡ No Twitter API keys needed — twitter-cli         │");
  console.log("  │   uses browser cookie authentication.                │");
  console.log("  │                                                      │");
  console.log("  │   Prerequisites:                                     │");
  console.log("  │     pip3 install twitter-cli                         │");
  console.log("  │     twitter status   # authenticate once via browser  │");
  console.log("  │                                                      │");
  console.log("  ╰──────────────────────────────────────────────────────╯");
  console.log("");
}

function printSaveSummary(config: Partial<Config>): void {
  console.log("");
  console.log("  ╭──────────────────────────────────────────────────────╮");
  console.log("  │                                                      │");
  console.log("  │   📋 Configuration Summary                           │");
  console.log("  │                                                      │");
  console.log(`  │     Keywords:        ${((config.nicheKeywords ?? []).join(", ") + "                    ").slice(0, 37)}│`);
  console.log(`  │     Reply Style:     ${(config.replyStyle ?? "curious" + "                    ").slice(0, 37)}│`);
  console.log("  │                                                      │");
  console.log("  ╰──────────────────────────────────────────────────────╯");
  console.log("");
}

// ── Interactive Steps ────────────────────────────────────────────────────────

/**
 * Ask for niche keywords.
 */
async function stepKeywords(rl: ReadlineInterface): Promise<string[]> {
  const DEFAULT = "indie dev, saas, build in public, coding, solopreneur";
  console.log("");
  console.log("  ── Step 1: Niche Keywords ────────────────────────────────────");
  console.log("");
  console.log("  These keywords are used to find relevant tweets to reply to.");
  console.log("  Separate multiple keywords with commas.");
  console.log("");

  const raw = await askWithDefault(rl, `  Keywords [${DEFAULT}]: `, DEFAULT);
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Ask for preferred reply style.
 */
async function stepReplyStyle(rl: ReadlineInterface): Promise<ReplyStyle> {
  const STYLES: { key: ReplyStyle; desc: string }[] = [
    { key: "curious", desc: "Ask thoughtful questions" },
    { key: "casual", desc: "Relaxed, conversational" },
    { key: "supportive", desc: "Warm and encouraging" },
    { key: "thoughtful", desc: "Substantive observations" },
    { key: "auto", desc: "Let AI decide based on post tone" },
  ];

  console.log("");
  console.log("  ── Step 2: Reply Style ───────────────────────────────────────");
  console.log("");
  console.log("  How would you like your replies to sound by default?");
  console.log("");

  for (let i = 0; i < STYLES.length; i++) {
    console.log(`    ${i + 1}. ${STYLES[i].key} — ${STYLES[i].desc}`);
  }
  console.log("");

  const choice = await askWithDefault(rl, "  Select [1-5] (default: 1): ", "1");
  const idx = Math.max(0, Math.min(parseInt(choice) - 1, STYLES.length - 1));
  return STYLES[idx].key;
}

// ── Main entry ───────────────────────────────────────────────────────────────

/**
 * Run the full interactive setup.
 *
 * @param account Optional account name (from `--account` flag).
 *   If provided, switches to this account before configuring.
 *   Returns `true` if config was saved, `false` if cancelled.
 */
export async function runInteractiveSetup(account?: string): Promise<boolean> {
  const rl = createReader();

  try {
    // If an account is specified, switch to it before setup
    if (account) {
      setActiveAccount(account);
      console.log("");
      console.log(`  Configuring account: ${account}`);
      console.log("");
    }

    printWelcome();

    // Step 1: Keywords
    const keywords = await stepKeywords(rl);

    // Step 2: Reply style
    const style = await stepReplyStyle(rl);

    // ── Build config ──────────────────────────────────────────────────
    const config: Partial<Config> = {
      nicheKeywords: keywords,
      replyStyle: style,
    };

    // ── Confirm and save ──────────────────────────────────────────────
    printSaveSummary(config);

    const confirm = await askWithDefault(rl, "  Save configuration? (Y/n): ", "y");
    if (confirm.toLowerCase() === "n") {
      console.log("");
      console.log("  ❌ Setup cancelled. No changes saved.");
      return false;
    }

    updateEffectiveConfig(config);
    console.log("");
    const configPath = account ? getAccountConfigPath(account) : CONFIG_PATH;
    console.log(`  ✅  Configuration saved to ${configPath}`);
    console.log("");
    console.log("  You can now start the MCP server:");
    console.log("");
    console.log("     npx replyflow-mcp");
    console.log("");
    console.log("  Or re-run setup anytime:");
    console.log("");
    console.log("     npx replyflow-mcp setup");
    console.log("");

    return true;
  } finally {
    rl.close();
  }
}
