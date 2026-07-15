import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── Config Type ──────────────────────────────────────────────────────────────

export type ReplyStyle =
  | "casual"
  | "curious"
  | "supportive"
  | "thoughtful"
  | "auto";

export interface Config {
  /** User's niche keywords for trending post search */
  nicheKeywords?: string[];
  /** Preferred reply style */
  replyStyle?: ReplyStyle;
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
 * Get the config directory path for a specific account.
 */
export function getAccountDir(accountName: string): string {
  return join(CONFIG_DIR, "accounts", accountName);
}

/**
 * Get the config file path for a specific account.
 */
export function getAccountConfigPath(accountName: string): string {
  return join(getAccountDir(accountName), "config.json");
}

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
}

/**
 * Get the config for the currently active account.
 *
 * - If an account is active (active_account file exists with a name),
 *   reads from ~/.replyflow/accounts/<name>/config.json.
 * - If no account is active, falls back to ~/.replyflow/config.json (default).
 * - If neither exists, returns default config.
 */
export function getEffectiveConfig(): Config {
  const activeAccount = getActiveAccount();
  if (activeAccount) {
    const accountPath = getAccountConfigPath(activeAccount);
    if (existsSync(accountPath)) {
      try {
        const raw = readFileSync(accountPath, "utf-8");
        const parsed = JSON.parse(raw) as Partial<Config>;
        return { ...DEFAULT_CONFIG, ...parsed };
      } catch (err) {
        console.error(
          `[ReplyFlow] Warning: failed to parse ${accountPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    // Account directory exists but no config file yet — return defaults
    return { ...DEFAULT_CONFIG };
  }
  return getConfig();
}

/**
 * Update the config for the currently active account (or default if none active).
 *
 * - If an account is active, writes to ~/.replyflow/accounts/<name>/config.json.
 * - If no account is active, writes to ~/.replyflow/config.json.
 */
export function updateEffectiveConfig(partial: Partial<Config>): Config {
  const activeAccount = getActiveAccount();
  if (activeAccount) {
    const accountDir = getAccountDir(activeAccount);
    if (!existsSync(accountDir)) {
      mkdirSync(accountDir, { recursive: true });
    }
    const accountPath = getAccountConfigPath(activeAccount);

    let current: Config = { ...DEFAULT_CONFIG };
    if (existsSync(accountPath)) {
      try {
        const raw = readFileSync(accountPath, "utf-8");
        current = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      } catch {
        // Use defaults
      }
    }

    const updated: Config = { ...current, ...partial };
    writeFileSync(accountPath, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  }
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
    console.error(
      `[ReplyFlow] Warning: failed to parse ${CONFIG_PATH}: ${err instanceof Error ? err.message : String(err)}`,
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
 * Prints a friendly message if nothing is configured yet.
 */
export function checkCredentials(
  config: Config,
  integrity?: ConfigIntegrityReport,
): boolean {
  const report = integrity ?? checkConfigIntegrity(config);

  if (!report.ok || report.warnings.length > 0) {
    console.error("");
    console.error("  ╭──────────────────────────────────────────────────────╮");
    console.error("  │                                                      │");
    console.error("  │   ReplyFlow – Configuration check                    │");
    console.error("  │                                                      │");

    if (!report.ok) {
      console.error("  │                                                      │");
      console.error("  │   ❌ Missing critical config:                       │");
      for (const item of report.missing) {
        console.error(`  │      ${item}`);
      }
    }

    if (report.warnings.length > 0) {
      console.error("  │                                                      │");
      console.error("  │   ⚠️  Warnings:                                      │");
      for (const item of report.warnings) {
        console.error(`  │      ${item}`);
      }
    }

    console.error("  │                                                      │");
    console.error("  │   Run 'npx replyflow-mcp setup' for interactive      │");
    console.error("  │   configuration.                                     │");
    console.error("  │                                                      │");
    console.error("  ╰──────────────────────────────────────────────────────╯");
    console.error("");
  }

  return report.ok;
}

/**
 * Returns the user's niche keywords from config, or the defaults.
 */
export function getNicheKeywords(config: Config): string[] {
  if (config.nicheKeywords && config.nicheKeywords.length > 0) {
    return config.nicheKeywords;
  }
  return DEFAULT_CONFIG.nicheKeywords!;
}
