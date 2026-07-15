import { execSync } from "child_process";
import { Config, getNicheKeywords } from "./config.js";

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

// ── CLI execution helper ─────────────────────────────────────────────────────

/**
 * Run a twitter CLI command and return parsed JSON.
 * Throws if the command fails or returns non-JSON output.
 */
function runTwitter(args: string[]): CliResponse {
  const cmd = `twitter ${args.join(" ")}`;
  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: "pipe",
    });
    return JSON.parse(output) as CliResponse;
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`twitter CLI error: ${err.message}`);
    }
    throw err;
  }
}

// ── Cached values ────────────────────────────────────────────────────────────

let _me: { id: string; username: string } | null = null;

/**
 * Resets cached client (useful when config changes at runtime).
 */
export function resetClient(): void {
  _me = null;
}

// ── Whoami ───────────────────────────────────────────────────────────────────

/**
 * Get the authenticated user's id and username.
 */
function getMe(): { id: string; username: string } {
  if (_me) return _me;

  const result = runTwitter(["whoami", "--json"]);
  const data = result.data as { user: { id: string; name: string; username: string; screenName: string } };
  _me = { id: data.user.id, username: data.user.screenName };
  return _me;
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
export function getTrendingPosts(
  config: Config,
  keywords?: string[],
): TweetData[] {
  const terms =
    keywords && keywords.length > 0
      ? keywords
      : getNicheKeywords(config);

  if (terms.length === 0) return [];

  // Build query string: quoted terms separated by spaces (twitter search handles OR internally)
  const query = terms.map((k) => `"${k}"`).join(" ");

  try {
    const result = runTwitter([
      "search", "--json", "-t", "latest", "-n", "20",
      "--exclude", "retweets",
      "--lang", "en",
      query,
    ]);

    if (!result.ok) return [];

    const tweets = result.data as CliTweetData[];
    return tweets.map((t) => toTweetData(t, "search"));
  } catch {
    return [];
  }
}

// ── Merge, dedup & sort ──────────────────────────────────────────────────────

/**
 * Merge multiple arrays of tweets, remove duplicates (by id),
 * and sort by interaction count descending.
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
  try {
    const result = runTwitter(["tweet", "--json", "-n", "5", tweetId]);
    if (!result.ok) return [];
    return result.data as CliTweetData[];
  } catch {
    return [];
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
    result.error =
      err instanceof Error ? err.message : "Unknown Twitter CLI error";
  }

  return result;
}
