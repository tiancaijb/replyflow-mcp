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
  /** What source this tweet came from */
  source: "timeline" | "mentions" | "search";
  /** Whether this tweet has been replied to (enriched by replyflow_list) */
  replied?: boolean;
  /** Context chain (populated for mentions in reply chains) */
  context?: TweetContext;
}

export interface TweetContext {
  root: TweetData;
  replies: TweetData[];
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

// ── getTimeline ──────────────────────────────────────────────────────────────

/**
 * Fetch the user's Home Timeline (most recent ~20 tweets).
 */
export function getTimeline(_config: Config): TweetData[] {
  const result = runTwitter(["feed", "--json", "-n", "20"]);
  if (!result.ok) return [];

  const tweets = result.data as CliTweetData[];
  return tweets.map((t) => toTweetData(t, "timeline"));
}

// ── getMentions ──────────────────────────────────────────────────────────────

/**
 * Fetch @mentions for the authenticated user (most recent ~20).
 * Uses `twitter search --to <username>` since twitter-cli has no dedicated mentions command.
 */
export function getMentions(_config: Config): TweetData[] {
  const me = getMe();

  const result = runTwitter([
    "search", "--json", "-t", "latest", "-n", "20",
    "--to", me.username,
  ]);

  if (!result.ok) return [];

  const tweets = result.data as CliTweetData[];

  // Filter only tweets that actually mention the user
  const mentionRegex = new RegExp(`@${me.username}\\b`, "i");
  return tweets
    .filter((t) => mentionRegex.test(t.text))
    .map((t) => toTweetData(t, "mentions"));
}

// ── getTweetContext ──────────────────────────────────────────────────────────

/**
 * Build context for a given tweet using `twitter tweet <id>` which returns
 * the parent tweet + all replies in one response.
 */
export function getTweetContext(
  _config: Config,
  tweetId: string,
): TweetContext {
  const result = runTwitter(["tweet", "--json", tweetId]);

  if (!result.ok) {
    throw new Error(`Failed to fetch tweet context for ${tweetId}`);
  }

  const tweets = result.data as CliTweetData[];

  if (tweets.length === 0) {
    throw new Error(`No data returned for tweet ${tweetId}`);
  }

  // First tweet is the root/conversation parent
  const root = toTweetData(tweets[0], "search");

  // Remaining are replies in the conversation
  const replies = tweets.slice(1).map((t) => toTweetData(t, "mentions"));

  return { root, replies };
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

const INTERACTION_MAP: Record<string, number> = {
  timeline: 1,
  mentions: 3,
  search: 1.5,
};

/**
 * Merge multiple sources of tweets, remove duplicates (by id),
 * and sort by "interaction count × source weight".
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

  // Sort: interaction volume × source relevance
  merged.sort((a, b) => {
    const scoreA = interactionScore(a);
    const scoreB = interactionScore(b);
    return scoreB - scoreA; // descending
  });

  return merged;
}

function interactionScore(tweet: TweetData): number {
  const weight = INTERACTION_MAP[tweet.source] ?? 1;
  const metrics = tweet.publicMetrics;
  if (!metrics) return weight;
  const interactions =
    metrics.retweetCount +
    metrics.replyCount +
    metrics.likeCount +
    metrics.quoteCount;
  return (interactions + 1) * weight;
}

// ── list ─────────────────────────────────────────────────────────────────────

/**
 * High-level: fetch all sources based on filter, return merged + sorted result.
 *
 * @param filter  "all" | "mentions" | "timeline"
 * @returns      ListResult with tweets array + optional user info
 */
export async function list(
  config: Config,
  filter: "all" | "mentions" | "timeline",
): Promise<ListResult> {
  const result: ListResult = { tweets: [] };

  try {
    const timeline: TweetData[] = [];
    const mentions: TweetData[] = [];
    const trending: TweetData[] = [];

    if (filter === "all" || filter === "timeline") {
      try {
        const tl = getTimeline(config);
        timeline.push(...tl);
      } catch {
        // Timeline failed — try trending as fallback
        try {
          const tr = getTrendingPosts(config);
          trending.push(...tr);
        } catch {
          // Both failed
        }
      }
    }

    if (filter === "all" || filter === "mentions") {
      try {
        const mn = getMentions(config);
        mentions.push(...mn);
      } catch {
        // Mentions failed
      }
    }

    // If no results from timeline/mentions, try trending as a last resort
    if (
      timeline.length === 0 &&
      mentions.length === 0 &&
      trending.length === 0
    ) {
      try {
        const tr = getTrendingPosts(config);
        trending.push(...tr);
      } catch {
        // Trending failed too
      }
    }

    // Merge & sort
    result.tweets = mergeAndSort(timeline, mentions, trending);

    // Enrich mentions with context chain
    if (
      result.tweets.length > 0 &&
      (filter === "all" || filter === "mentions")
    ) {
      const replyTweets = result.tweets.filter((t) => t.inReplyToTweetId);
      const toEnrich = replyTweets.slice(0, 5); // limit to avoid excessive CLI calls
      for (const tweet of toEnrich) {
        try {
          const ctx = getTweetContext(config, tweet.id);
          tweet.context = ctx;
        } catch {
          // Context fetch failed — skip
        }
      }
    }

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
