import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── Config Type ──────────────────────────────────────────────────────────────

export interface Config {
  /** Twitter API Key (Consumer Key, Essential / Free tier) */
  twitterApiKey?: string;
  /** Twitter API Secret (Consumer Secret) */
  twitterApiSecret?: string;
  /** Twitter Access Token (OAuth 1.0a user context) */
  twitterAccessToken?: string;
  /** Twitter Access Token Secret (OAuth 1.0a user context) */
  twitterAccessTokenSecret?: string;
  /** User preference: reply style */
  preferredStyle?: "casual" | "helpful" | "professional";
}

const DEFAULT_CONFIG: Config = {
  preferredStyle: "casual",
};

// ── Paths ────────────────────────────────────────────────────────────────────

export const CONFIG_DIR = join(homedir(), ".replyflow");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Read config from ~/.replyflow/config.json.
 * If the file doesn't exist, returns the default config (does not throw).
 * Env vars are NOT merged here — callers should use resolveTwitterApiKey/Secret.
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

// ── Environment helpers ─────────────────────────────────────────────────────

/**
 * Returns the Twitter API key from env var or config file.
 * Env vars take precedence over config file.
 * Throws if neither is set.
 */
export function resolveTwitterApiKey(config: Config): string {
  const env = process.env.TWITTER_API_KEY;
  if (env) return env;

  if (config.twitterApiKey) return config.twitterApiKey;

  throw new Error(
    "Twitter API key not found. Set TWITTER_API_KEY environment variable " +
      "or add 'twitterApiKey' to ~/.replyflow/config.json",
  );
}

/**
 * Returns the Twitter API secret from env var or config file.
 * Env vars take precedence over config file.
 * Throws if neither is set.
 */
export function resolveTwitterApiSecret(config: Config): string {
  const env = process.env.TWITTER_API_SECRET;
  if (env) return env;

  if (config.twitterApiSecret) return config.twitterApiSecret;

  throw new Error(
    "Twitter API secret not found. Set TWITTER_API_SECRET environment variable " +
      "or add 'twitterApiSecret' to ~/.replyflow/config.json",
  );
}

/**
 * Returns the Twitter Access Token from env var or config file.
 * Env vars take precedence. Returns undefined if not set (optional).
 */
export function resolveTwitterAccessToken(config: Config): string | undefined {
  const env = process.env.TWITTER_ACCESS_TOKEN;
  if (env) return env;
  return config.twitterAccessToken;
}

/**
 * Returns the Twitter Access Token Secret from env var or config file.
 * Env vars take precedence. Returns undefined if not set (optional).
 */
export function resolveTwitterAccessTokenSecret(config: Config): string | undefined {
  const env = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  if (env) return env;
  return config.twitterAccessTokenSecret;
}

/**
 * Check whether the user has provided enough credential info to operate.
 * Prints a friendly banner if nothing is configured yet.
 */
export function checkCredentials(config: Config): boolean {
  const hasEnvKey = !!process.env.TWITTER_API_KEY;
  const hasEnvSecret = !!process.env.TWITTER_API_SECRET;
  const hasConfigKey = !!config.twitterApiKey;
  const hasConfigSecret = !!config.twitterApiSecret;

  const ok = (hasEnvKey && hasEnvSecret) || (hasConfigKey && hasConfigSecret);

  if (!ok) {
    console.error("");
    console.error("  ╭──────────────────────────────────────────────────────╮");
    console.error("  │                                                      │");
    console.error("  │   ReplyFlow – Twitter API credentials needed         │");
    console.error("  │                                                      │");
    console.error("  │   Set these env vars:                                │");
    console.error("  │     TWITTER_API_KEY                                  │");
    console.error("  │     TWITTER_API_SECRET                               │");
    console.error("  │                                                      │");
    console.error("  │   Or create ~/.replyflow/config.json:                │");
    console.error("  │   {                                                  │");
    console.error('  │     "twitterApiKey": "your_key",                     │');
    console.error('  │     "twitterApiSecret": "your_secret"                │');
    console.error("  │   }                                                  │");
    console.error("  │                                                      │");
    console.error("  │   For timeline & mentions, also set:                 │");
    console.error("  │     TWITTER_ACCESS_TOKEN                             │");
    console.error("  │     TWITTER_ACCESS_TOKEN_SECRET                      │");
    console.error("  │                                                      │");
    console.error("  ╰──────────────────────────────────────────────────────╯");
    console.error("");
  }

  return ok;
}
