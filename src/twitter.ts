import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";
import { Config, getNicheKeywords } from "./config.js";
import logger from "./logger.js";
import { cache } from "./cache.js";
import {
  CliError,
  CliTimeoutError,
  CliNetworkError,
  CliParseError,
  classifyCliError,
  getUserFriendlyMessage,
} from "./errors.js";

// ── Public types ─────────────────────────────────────────────────────────────

export interface TweetAuthor {
  id: string;
  name: string;
  username: string;
}

export interface TweetData {
  id: string;
  text: string;
  author?: TweetAuthor;
  createdAt?: string;
  publicMetrics?: {
    retweetCount: number;
    replyCount: number;
    likeCount: number;
    quoteCount: number;
  };
  inReplyToTweetId?: string;
  conversationId?: string;
  /** Source is always "search" in project-centric mode */
  source: "search";
  /** Whether this tweet has been replied to (enriched by replyflow_list) */
  replied?: boolean;
}

/**
 * Combined output for replyflow_list.
 */
export interface ListResult {
  tweets: TweetData[];
  userId?: string;
  error?: string;
}

// ── CLI Interface types ──────────────────────────────────────────────────────

interface CliResponse {
  ok: boolean;
  schema_version: string;
  data: unknown;
}

interface CliTweetData {
  id: string;
  text: string;
  author: {
    id: string;
    name: string;
    screenName: string;
    profileImageUrl?: string;
    verified?: boolean;
  };
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views: number;
    bookmarks: number;
  };
  createdAt: string;
  createdAtLocal: string;
  createdAtISO: string;
  media: unknown[];
  urls: string[];
  isRetweet: boolean;
  retweetedBy: unknown | null;
  lang: string;
  score: number | null;
  quotedTweet?: {
    id: string;
    text: string;
    author: { screenName: string; name: string };
  };
}

// ── Sync sleep helper ─────────────────────────────────────────────────────────

/**
 * Synchronous sleep for retry backoff.
 * Only used on error paths (network retries), never during normal operation.
 */
function sleepSync(ms: number): void {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    /* busy-wait — acceptable on error paths */
  }
}

// ── Error formatting helper ───────────────────────────────────────────────────

/**
 * Format an unknown error into a user-friendly string.
 * Prefers CliError's getUserFriendlyMessage, falls back to Error.message.
 */
function formatCliError(err: unknown): string {
  if (err instanceof CliError) return getUserFriendlyMessage(err);
  if (err instanceof Error) return err.message;
  return String(err);
}

// ── CLI execution helper ─────────────────────────────────────────────────────

/**
 * Run a twitter CLI command and return parsed JSON.
 *
 * Features:
 * - Timeout control (default 30s)
 * - Automatic retry with exponential backoff for network errors
 * - Error classification into typed CliError subclasses
 * - User-friendly error messages
 *
 * Throws a classified CliError on failure.
 */
function runTwitter(
  args: string[],
  options?: { timeout?: number },
): CliResponse {
  // ── Mock mode for integration tests ────────────────────────────────
  if (process.env.REPLYFLOW_MOCK_CLI === "true") {
    return runTwitterMock(args);
  }

  const timeout = options?.timeout ?? 30000;
  const maxRetries = 2;
  const retryDelays = [1000, 3000];
  let lastError: CliError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Sleep before retries (not before first attempt)
    if (attempt > 0) {
      const delay =
        retryDelays[attempt - 1] ?? retryDelays[retryDelays.length - 1]!;
      logger.debug(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
      sleepSync(delay);
    }

    try {
      logger.debug(`Running: twitter ${args.slice(0, 3).join(" ")}...`);
      const result = spawnSync("twitter", args, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        shell: false,
        timeout,
      });

      // ── Spawn error (process never ran) ────────────────────────────
      if (result.error) {
        const classified = classifyCliError(
          result.error,
          result.stderr,
          result.status,
          result.signal,
        );

        // Recoverable: retry network errors
        if (classified instanceof CliNetworkError && attempt < maxRetries) {
          lastError = classified;
          continue;
        }
        throw classified;
      }

      // ── Timeout (process killed by signal) ─────────────────────────
      if (result.signal === "SIGTERM" && result.status === null) {
        throw new CliTimeoutError(
          `Twitter CLI timed out after ${timeout / 1000}s`,
          timeout,
        );
      }

      // ── Non-zero exit code ────────────────────────────────────────
      if (result.status !== 0) {
        const classified = classifyCliError(
          null,
          result.stderr,
          result.status,
          result.signal,
        );
        // Auth, rate-limit, and generic errors are not retried
        throw classified;
      }

      // ── Success — parse JSON ──────────────────────────────────────
      try {
        return JSON.parse(result.stdout) as CliResponse;
      } catch (parseErr) {
        throw new CliParseError(
          `Failed to parse twitter-cli output: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        );
      }
    } catch (err) {
      // Recoverable: retry network errors (outer catch catches CliNetworkError
      // that could come from classifyCliError or from JSON.parse wrapping)
      if (err instanceof CliNetworkError && attempt < maxRetries) {
        lastError = err;
        continue;
      }
      // All other errors (auth, timeout, rate-limit, parse, unknown) propagate
      throw err;
    }
  }

  // All retries exhausted
  throw lastError ?? new CliError("Twitter CLI failed after multiple retries");
}

// ── Cache integration ─────────────────────────────────────────────────────────

const ACCOUNT_CACHE_TTL = 300_000; // 5 minutes for whoami

/**
 * Build a cache key for the search given the current account and keywords.
 */
function searchCacheKey(account: string, keywords: string[]): string {
  return `search:${account}:${[...keywords].sort().join(",")}`;
}

/**
 * Build a cache key for the whoami result.
 */
function meCacheKey(account: string): string {
  return `me:${account}`;
}

/**
 * Resets all caches (useful when config changes at runtime).
 */
/** Clear all caches (whoami, search results). */
export function resetClient(): void {
  cache.clear();
}

// ── Whoami ───────────────────────────────────────────────────────────────────

/**
 * Get the authenticated user's id and username.
 * Results are cached per account for 5 minutes.
 */
function getMe(): { id: string; username: string } {
  const account = _resolveAccount();
  const key = meCacheKey(account);
  const cached = cache.get<{ id: string; username: string }>(key);
  if (cached) return cached;

  logger.debug("Fetching whoami from twitter-cli");
  const result = runTwitter(["whoami", "--json"]);
  const data = result.data as {
    user: { id: string; name: string; username: string; screenName: string };
  };
  const me = { id: data.user.id, username: data.user.screenName };
  cache.set(key, me, ACCOUNT_CACHE_TTL);
  return me;
}

/**
 * Resolve current account name for cache key purposes.
 */
function _resolveAccount(): string {
  try {
    const { getActiveAccount } = require("./config.js");
    return getActiveAccount() || "default";
  } catch {
    return "default";
  }
}

// ── Tweet conversion ─────────────────────────────────────────────────────────

/**
 * Convert a CLI tweet data object into our internal TweetData shape.
 */
function toTweetData(
  tweet: CliTweetData,
  source: TweetData["source"],
): TweetData {
  const author = tweet.author
    ? {
        id: tweet.author.id,
        name: tweet.author.name,
        username: tweet.author.screenName,
      }
    : undefined;

  // Detect replies by text starting with @username
  const inReplyToMatch = tweet.text.match(/^@(\S+)/);
  const inReplyToTweetId = inReplyToMatch ? tweet.id : undefined;

  return {
    id: tweet.id,
    text: tweet.text,
    author,
    createdAt: tweet.createdAtISO,
    publicMetrics: {
      retweetCount: tweet.metrics.retweets ?? 0,
      replyCount: tweet.metrics.replies ?? 0,
      likeCount: tweet.metrics.likes ?? 0,
      quoteCount: tweet.metrics.quotes ?? 0,
    },
    inReplyToTweetId,
    conversationId: tweet.id,
    source,
  };
}

// ── getTrendingPosts ─────────────────────────────────────────────────────────

/**
 * Search for niche-relevant tweets by keywords.
 */
/**
 * Search for niche-relevant tweets.
 * @param config - App config (for keywords).
 * @param keywords - Optional override keywords.
 * @returns Array of tweet data.
 */
export function getTrendingPosts(
  config: Config,
  keywords?: string[],
): TweetData[] {
  const terms =
    keywords && keywords.length > 0 ? keywords : getNicheKeywords(config);

  if (terms.length === 0) return [];

  // Build query string: terms joined with OR
  const query = terms.map((k) => `"${k}"`).join(" OR ");

  // Check cache
  const account = _resolveAccount();
  const cacheKey = searchCacheKey(account, terms);
  const cached = cache.get<TweetData[]>(cacheKey);
  if (cached) return cached;

  logger.debug(`Searching tweets for: ${query}`);

  try {
    const result = runTwitter([
      "search",
      "--json",
      "-t",
      "latest",
      "-n",
      "20",
      "--exclude",
      "retweets",
      "--lang",
      "en",
      query,
    ]);

    if (!result.ok) {
      logger.debug("Search returned not ok");
      return [];
    }

    const tweets = result.data as CliTweetData[];
    const mapped = tweets.map((t) => toTweetData(t, "search"));
    logger.debug(`Got ${mapped.length} search results (caching)`);

    // Cache the result
    cache.set(cacheKey, mapped);

    return mapped;
  } catch (err) {
    logger.error(`Search failed: ${formatCliError(err)}`);
    return [];
  }
}

// ── Merge, dedup & sort ──────────────────────────────────────────────────────

/**
 * Merge multiple arrays of tweets, remove duplicates (by id),
 * and sort by interaction count descending.
 */
/**
 * Merge tweet arrays, deduplicate by id, sort by interaction count.
 * @param sources - One or more tweet arrays.
 * @returns Merged and sorted array.
 */
export function mergeAndSort(...sources: TweetData[][]): TweetData[] {
  const seen = new Set<string>();
  const merged: TweetData[] = [];

  for (const batch of sources) {
    for (const tweet of batch) {
      if (seen.has(tweet.id)) continue;
      seen.add(tweet.id);
      merged.push(tweet);
    }
  }

  // Sort by interaction count descending
  merged.sort((a, b) => {
    const scoreA = interactionScore(a);
    const scoreB = interactionScore(b);
    return scoreB - scoreA;
  });

  return merged;
}

function interactionScore(tweet: TweetData): number {
  const metrics = tweet.publicMetrics;
  if (!metrics) return 0;
  return (
    metrics.retweetCount +
    metrics.replyCount +
    metrics.likeCount +
    metrics.quoteCount
  );
}

// ── getTweetWithReplies ───────────────────────────────────────────────────────

/**
 * Fetch a tweet and its replies using `twitter tweet`.
 * Returns an array of CliTweetData (index 0 = main tweet, rest = replies).
 */
export function getTweetWithReplies(tweetId: string): CliTweetData[] {
  logger.debug(`Fetching tweet thread: ${tweetId}`);
  try {
    const result = runTwitter(["tweet", "--json", "-n", "5", tweetId]);
    if (!result.ok) {
      logger.debug(`Tweet fetch returned not ok for ${tweetId}`);
      return [];
    }
    return result.data as CliTweetData[];
  } catch (err) {
    logger.error(`Failed to fetch tweet ${tweetId}: ${formatCliError(err)}`);
    return [];
  }
}

// ── Mock CLI (for integration tests) ──────────────────────────────────────────

/**
 * Determine the CLI command name from the arguments.
 * First non-flag, non-option argument is the command (e.g., "search", "whoami", "tweet").
 */
function extractCommand(args: string[]): string {
  for (const arg of args) {
    if (!arg.startsWith("-")) return arg;
  }
  return "unknown";
}

/**
 * Mock version of runTwitter that reads from fixture files.
 * Only used when REPLYFLOW_MOCK_CLI=true.
 * Fixtures are resolved relative to the project root (tests/fixtures/{command}.json).
 */
function runTwitterMock(args: string[]): CliResponse {
  const command = extractCommand(args);
  // Resolve fixtures relative to CWD (project root when running tests)
  const fixturePath = join(
    process.cwd(),
    "tests",
    "fixtures",
    `${command}.json`,
  );

  try {
    const raw = readFileSync(fixturePath, "utf-8");
    return JSON.parse(raw) as CliResponse;
  } catch (_err) {
    logger.error(
      `Mock CLI: fixture not found for command "${command}" at ${fixturePath}`,
    );
    return {
      ok: false,
      schema_version: "1",
      data: [],
    };
  }
}

// ── list ─────────────────────────────────────────────────────────────────────

/**
 * High-level: search for niche-relevant tweets using project keywords.
 *
 * @param config       Effective config
 * @param projectName  Optional project name (overrides activeProject)
 * @returns            ListResult with tweets array + optional user info
 */
export async function list(
  config: Config,
  projectName?: string,
): Promise<ListResult> {
  const result: ListResult = { tweets: [] };

  try {
    // Resolve keywords: use specified project, or active project, or fallback
    let keywords: string[] | undefined;

    if (projectName && config.projects?.[projectName]?.keywords) {
      keywords = config.projects[projectName].keywords;
    }

    const tweets = getTrendingPosts(config, keywords);
    result.tweets = mergeAndSort(tweets);

    // Get user info
    try {
      const me = getMe();
      result.userId = me.id;
    } catch {
      // Not critical
    }
  } catch (err) {
    result.error = formatCliError(err);
  }

  return result;
}
