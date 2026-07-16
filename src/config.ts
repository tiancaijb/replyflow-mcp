import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import logger from "./logger.js";
import type { LogLevel } from "./logger.js";

// ── Config Type ──────────────────────────────────────────────────────────────

export type ReplyStyle =
  "casual" | "curious" | "supportive" | "thoughtful" | "auto";

export interface Project {
  /** Project display name */
  name: string;
  /** One-line description of the project */
  description: string;
  /** Project URL */
  url: string;
  /** Keywords for finding relevant discussions on Twitter */
  keywords: string[];
}

export interface Config {
  /** Currently active project name (key in `projects` map) */
  activeProject?: string;
  /** Map of project name to project configuration */
  projects?: Record<string, Project>;
  /** Fallback niche keywords (used when no active project has keywords) */
  nicheKeywords?: string[];
  /** Preferred reply style */
  replyStyle?: ReplyStyle;
  /**
   * Language for reply explanations (e.g. "中文", "English", "日本語").
   * Auto-detected from user's first input and confirmed before setting.
   * When not set, the AI should detect and ask for confirmation.
   */
  language?: string;
  /** Log level for the structured logger (overrides LOG_LEVEL env var). */
  logLevel?: LogLevel;
  /**
   * Cache TTL for twitter-cli search results (in seconds).
   * Default: 60. Set to 0 to disable caching entirely.
   */
  cacheTTL?: number;
  /**
   * Interval for automatic follow-up checks (in minutes).
   * When set, the server periodically checks for new replies on sent tweets.
   * Set to 0 to disable. Default: 5.
   */
  followupInterval?: number;
}

const DEFAULT_CONFIG: Config = {
  replyStyle: "curious",
  nicheKeywords: [
    "indie dev",
    "saas",
    "build in public",
    "coding",
    "solopreneur",
  ],
};

// ── Paths ────────────────────────────────────────────────────────────────────

export const CONFIG_DIR = join(homedir(), ".replyflow");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const ACTIVE_ACCOUNT_PATH = join(CONFIG_DIR, "active_account");

// ── Account helpers ──────────────────────────────────────────────────────────

/**
 * Read the currently active account name from ~/.replyflow/active_account.
 * Returns undefined if no account is active or the file doesn't exist.
 */
export function getActiveAccount(): string | undefined {
  try {
    if (existsSync(ACTIVE_ACCOUNT_PATH)) {
      const raw = readFileSync(ACTIVE_ACCOUNT_PATH, "utf-8").trim();
      return raw || undefined;
    }
  } catch {
    // Ignore read errors
  }
  return undefined;
}

/**
 * Set the active account by writing to ~/.replyflow/active_account.
 * Creates the config directory if it doesn't exist.
 */
export function setActiveAccount(account: string): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(ACTIVE_ACCOUNT_PATH, account, "utf-8");

  // Clear all caches — new account means different search results and identity
  try {
    const { cache } = require("./cache.js");
    cache.clear();
  } catch {
    // cache module may not be available in all contexts
  }
}

/**
 * Get the effective config from ~/.replyflow/config.json.
 * Falls back to defaults if the file doesn't exist or is corrupt.
 *
 * Note: Config is no longer account-scoped. The active account is only
 * used for twitter-cli authentication, not for config routing.
 */
export function getEffectiveConfig(): Config {
  return getConfig();
}

/**
 * Update the config in ~/.replyflow/config.json.
 *
 * Note: Config is no longer account-scoped. All updates go to the single
 * config file regardless of the active twitter account.
 */
export function updateEffectiveConfig(partial: Partial<Config>): Config {
  return updateConfig(partial);
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Read config from ~/.replyflow/config.json.
 * If the file doesn't exist, returns the default config (does not throw).
 *
 * Note: For account-aware config reading, use getEffectiveConfig() instead.
 */
export function getConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    logger.warn(
      `Failed to parse ${CONFIG_PATH}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { ...DEFAULT_CONFIG };
  }
}

// ── Write / Update ──────────────────────────────────────────────────────────

export function updateConfig(partial: Partial<Config>): Config {
  const current = getConfig();
  const updated: Config = { ...current, ...partial };

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

// ── Config integrity ─────────────────────────────────────────────────────────

export interface ConfigIntegrityReport {
  /** true when all critical fields are present */
  ok: boolean;
  /** Fields that are missing and critical */
  missing: string[];
  /** Issues that won't break the server but limit functionality */
  warnings: string[];
}

/**
 * Check config completeness without printing anything.
 * Returns a report of missing / warning fields.
 *
 * With twitter-cli backend, no API keys are needed —
 * auth is handled by browser cookies.
 */
export function checkConfigIntegrity(_config: Config): ConfigIntegrityReport {
  const missing: string[] = [];
  const warnings: string[] = [];

  // twitter-cli uses cookie-based auth, no API keys required.
  // If the CLI isn't installed or auth fails, tools will error at runtime
  // with a clear message.

  return { ok: true, missing, warnings };
}

/**
 * Check whether the user has provided enough credential info to operate.
 * Logs messages if something is missing.
 */
export function checkCredentials(
  config: Config,
  integrity?: ConfigIntegrityReport,
): boolean {
  const report = integrity ?? checkConfigIntegrity(config);

  if (!report.ok || report.warnings.length > 0) {
    logger.info("╭──────────────────────────────────────────────────────╮");
    logger.info("│                                                      │");
    logger.info("│   ReplyFlow – Configuration check                    │");
    logger.info("│                                                      │");

    if (!report.ok) {
      logger.info("│                                                      │");
      logger.warn("│   ❌ Missing critical config:                       │");
      for (const item of report.missing) {
        logger.warn(`│      ${item}`);
      }
    }

    if (report.warnings.length > 0) {
      logger.info("│                                                      │");
      logger.warn("│   ⚠️  Warnings:                                      │");
      for (const item of report.warnings) {
        logger.warn(`│      ${item}`);
      }
    }

    logger.info("│                                                      │");
    logger.info("│   Run 'npx replyflow-mcp setup' for interactive      │");
    logger.info("│   configuration.                                     │");
    logger.info("│                                                      │");
    logger.info("╰──────────────────────────────────────────────────────╯");
  }

  return report.ok;
}

/**
 * Returns keywords to use for niche search.
 *
 * Priority:
 * 1. Active project's keywords (if `activeProject` is set and the project exists)
 * 2. Top-level `nicheKeywords` in config
 * 3. Default keywords
 */
export function getNicheKeywords(config: Config): string[] {
  const activeProjectName = config.activeProject;
  if (
    activeProjectName &&
    config.projects?.[activeProjectName]?.keywords?.length
  ) {
    return config.projects[activeProjectName].keywords;
  }
  if (config.nicheKeywords && config.nicheKeywords.length > 0) {
    return config.nicheKeywords;
  }
  return DEFAULT_CONFIG.nicheKeywords!;
}
