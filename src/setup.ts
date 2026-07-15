/**
 * replyflow-mcp interactive setup.
 *
 * Usage: npx replyflow-mcp setup
 *
 * Walks the user through:
 *   1. Project info (name, description, URL)
 *   2. Project keywords for niche search
 *   3. Preferred reply style
 *   4. Save to config file
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
  console.log("  │   ReplyFlow helps you find relevant Twitter          │");
  console.log("  │   conversations and naturally promote your project.  │");
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
  const projectName = config.activeProject ?? "(none)";
  const project = config.projects?.[projectName];
  console.log("");
  console.log("  ╭──────────────────────────────────────────────────────╮");
  console.log("  │                                                      │");
  console.log("  │   📋 Configuration Summary                           │");
  console.log("  │                                                      │");
  console.log(`  │     Project:         ${(projectName + "                    ").slice(0, 37)}│`);
  if (project) {
    console.log(`  │     Description:     ${(project.description + "                    ").slice(0, 37)}│`);
    console.log(`  │     URL:             ${(project.url + "                    ").slice(0, 37)}│`);
    console.log(`  │     Keywords:        ${(project.keywords.join(", ") + "                    ").slice(0, 37)}│`);
  }
  console.log(`  │     Reply Style:     ${(config.replyStyle ?? "curious" + "                    ").slice(0, 37)}│`);
  console.log(`  │     Language:        ${((config.language ?? "(auto-detect on first use)") + "                    ").slice(0, 37)}│`);
  console.log("  │                                                      │");
  console.log("  ╰──────────────────────────────────────────────────────╯");
  console.log("");
}

// ── Interactive Steps ────────────────────────────────────────────────────────

/**
 * Ask for project name.
 */
async function stepProjectName(rl: ReadlineInterface): Promise<string> {
  console.log("");
  console.log("  ── Step 1: Project Name ───────────────────────────────────────");
  console.log("");
  console.log("  What's your project called? (e.g. 'ReplyFlow', 'My SaaS')");
  console.log("  This is used to identify the project in your config.");
  console.log("");

  return await ask(rl, "  Project name: ");
}

/**
 * Ask for project description.
 */
async function stepProjectDescription(
  rl: ReadlineInterface,
  projectName: string,
): Promise<string> {
  console.log("");
  console.log("  ── Step 2: Project Description ────────────────────────────────");
  console.log("");
  console.log(`  Describe ${projectName} in one line.`);
  console.log("  (e.g. 'AI-powered code review for teams', 'Twitter reply manager')");
  console.log("");

  return await ask(rl, "  Description: ");
}

/**
 * Ask for project URL.
 */
async function stepProjectUrl(
  rl: ReadlineInterface,
  projectName: string,
): Promise<string> {
  console.log("");
  console.log("  ── Step 3: Project URL ────────────────────────────────────────");
  console.log("");
  console.log(`  What's the URL for ${projectName}?`);
  console.log("");

  return await ask(rl, "  URL: ");
}

/**
 * Ask for niche keywords.
 */
async function stepKeywords(rl: ReadlineInterface): Promise<string[]> {
  const DEFAULT = "indie dev, saas, build in public, coding, solopreneur";
  console.log("");
  console.log("  ── Step 4: Keywords for Topic Search ───────────────────────────");
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
  console.log("  ── Step 5: Reply Style ─────────────────────────────────────────");
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
 * Returns `true` if config was saved, `false` if cancelled.
 */
export async function runInteractiveSetup(): Promise<boolean> {
  const rl = createReader();

  try {
    printWelcome();

    // Step 1: Project name
    const projectName = await stepProjectName(rl);
    if (!projectName) {
      console.log("");
      console.log("  ❌ Project name is required. Setup cancelled.");
      return false;
    }

    // Step 2: Project description
    const projectDescription = await stepProjectDescription(rl, projectName);

    // Step 3: Project URL
    const projectUrl = await stepProjectUrl(rl, projectName);

    // Step 4: Keywords
    const keywords = await stepKeywords(rl);

    // Step 5: Reply style
    const style = await stepReplyStyle(rl);

    // Step 6: Language (optional)
    console.log("");
    console.log("  ── Step 6: Language for Reply Explanations ────────────────");
    console.log("");
    console.log("  Language used to explain generated reply options to you.");
    console.log("  If not set, the AI will auto-detect from your first input.");
    console.log("");
    const langRaw = await askWithDefault(
      rl,
      '  Language [留空则 AI 自动检测] (e.g. "中文", "English", "日本語"): ',
      "",
    );
    const language = langRaw.trim() || undefined;

    // ── Build config ──────────────────────────────────────────────────
    const config: Partial<Config> = {
      activeProject: projectName,
      projects: {
        [projectName]: {
          name: projectName,
          description: projectDescription,
          url: projectUrl,
          keywords,
        },
      },
      replyStyle: style,
      language,
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
    console.log(`  ✅  Configuration saved to ${CONFIG_PATH}`);
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
