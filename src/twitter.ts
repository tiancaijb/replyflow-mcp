import {
  TwitterApi,
  TweetV2,
  UserV2,
  TweetV2SingleResult,
  TweetSearchRecentV2Paginator,
  TweetHomeTimelineV2Paginator,
  TweetUserMentionTimelineV2Paginator,
  Tweetv2FieldsParams,
} from "twitter-api-v2";

import {
  Config,
  resolveTwitterApiKey,
  resolveTwitterApiSecret,
  resolveTwitterAccessToken,
  resolveTwitterAccessTokenSecret,
  resolveOAuth2ClientId,
  resolveOAuth2AccessToken,
  resolveOAuth2RefreshToken,
  resolveOAuth2TokenExpiresAt,
  getNicheKeywords,
  updateEffectiveConfig,
} from "./config.js";

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

// ── Shared API params ────────────────────────────────────────────────────────

const TWEET_EXPANSIONS: Tweetv2FieldsParams["expansions"] = [
  "author_id",
  "referenced_tweets.id",
  "referenced_tweets.id.author_id",
];

const TWEET_FIELDS: Tweetv2FieldsParams["tweet.fields"] = [
  "created_at",
  "public_metrics",
  "conversation_id",
  "in_reply_to_user_id",
  "referenced_tweets",
];

const USER_FIELDS: Tweetv2FieldsParams["user.fields"] = [
  "name",
  "username",
];

/** Common fields passed to every tweet-fetching call */
const API_PARAMS: Partial<Tweetv2FieldsParams> = {
  expansions: TWEET_EXPANSIONS,
  "tweet.fields": TWEET_FIELDS,
  "user.fields": USER_FIELDS,
};

// ── Client init ──────────────────────────────────────────────────────────────

let _client: TwitterApi | null = null;
let _bearerClient: TwitterApi | null = null;
let _me: UserV2 | null = null;

/**
 * Resets cached client (useful when config changes at runtime).
 */
export function resetClient(): void {
  _client = null;
  _bearerClient = null;
  _me = null;
}

// ── OAuth 2.0 PKCE helpers ───────────────────────────────────────────────────

/**
 * Check whether the OAuth 2.0 access token is expired (or close to expiry).
 * Returns true if no expiry info is available (assumes valid).
 */
function isOAuth2TokenExpired(config: Config): boolean {
  const expiresAt = resolveOAuth2TokenExpiresAt(config);
  if (!expiresAt) return false;
  // Consider expired 30 seconds before actual expiry to be safe
  return Date.now() >= new Date(expiresAt).getTime() - 30_000;
}

/**
 * Try to refresh the OAuth 2.0 access token using the refresh token.
 * Silently returns null on failure; the caller falls back gracefully.
 */
async function tryRefreshOAuth2Token(config: Config): Promise<Config | null> {
  const clientId = resolveOAuth2ClientId(config);
  const refreshToken = resolveOAuth2RefreshToken(config);

  if (!clientId || !refreshToken) return null;

  try {
    const oauthClient = new TwitterApi({ clientId });
    const result = await oauthClient.refreshOAuth2Token(refreshToken);

    // Update config with new tokens (writes to active account or default)
    const updatedConfig = updateEffectiveConfig({
      oauth2AccessToken: result.accessToken,
      oauth2RefreshToken: result.refreshToken,
      oauth2TokenExpiresAt: new Date(
        Date.now() + result.expiresIn * 1000,
      ).toISOString(),
    });

    // Reset cached client so the next call picks up the new token
    resetClient();

    return updatedConfig;
  } catch {
    // Refresh failed — caller should fall back
    return null;
  }
}

/**
 * Create a user-context TwitterApi client from the OAuth 2.0 PKCE access token.
 * Returns null if no OAuth 2.0 token is available.
 */
function tryGetOAuth2UserClient(config: Config): TwitterApi | null {
  const accessToken = resolveOAuth2AccessToken(config);
  if (!accessToken) return null;
  return new TwitterApi(accessToken);
}

// ── Auth strategy ────────────────────────────────────────────────────────────

/**
 * Determine the best available user-context client.
 *
 * Priority:
 *   1. OAuth 2.0 PKCE access token (try refresh if expired)
 *   2. OAuth 1.0a user tokens
 *
 * Throws if no user-context auth is available.
 */
async function getUserClient(config: Config): Promise<TwitterApi> {
  // ── Try OAuth 2.0 PKCE first ──────────────────────────────────────────
  const oauth2Token = resolveOAuth2AccessToken(config);
  if (oauth2Token) {
    // If expired, try to refresh
    if (isOAuth2TokenExpired(config)) {
      const refreshed = await tryRefreshOAuth2Token(config);
      if (refreshed) {
        const freshToken = resolveOAuth2AccessToken(refreshed);
        if (freshToken) {
          return new TwitterApi(freshToken);
        }
      }
      // Refresh failed — fall through to OAuth 1.0a if available
    } else {
      return new TwitterApi(oauth2Token);
    }
  }

  // ── Fall back to OAuth 1.0a ───────────────────────────────────────────
  const appKey = resolveTwitterApiKey(config);
  const appSecret = resolveTwitterApiSecret(config);
  const accessToken = resolveTwitterAccessToken(config);
  const accessSecret = resolveTwitterAccessTokenSecret(config);

  if (accessToken && accessSecret) {
    if (_client) return _client;
    _client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
    return _client;
  }

  throw new Error(
    "No user-context auth available. Set up OAuth 2.0 via 'npx replyflow-mcp setup', " +
      "or set TWITTER_ACCESS_TOKEN + TWITTER_ACCESS_TOKEN_SECRET env vars.",
  );
}

/**
 * Create (or return cached) App-only Bearer-token client.
 * Works for tweet lookup and search without user context.
 */
async function getBearerClient(config: Config): Promise<TwitterApi> {
  if (_bearerClient) return _bearerClient;

  const appKey = resolveTwitterApiKey(config);
  const appSecret = resolveTwitterApiSecret(config);

  const tmp = new TwitterApi({ appKey, appSecret });
  _bearerClient = await tmp.appLogin();
  return _bearerClient;
}

/**
 * Get the authenticated user.
 * Works with OAuth 2.0 PKCE or OAuth 1.0a.
 */
async function getMe(config: Config): Promise<UserV2> {
  if (_me) return _me;
  const client = await getUserClient(config);
  const { data } = await client.v2.me();
  _me = data;
  return data;
}

// ── Tweet → TweetData helpers ────────────────────────────────────────────────

/**
 * Build a user map from Paginator includes or TweetV2SingleResult includes.
 * twitter-api-v2 puts `includes` at top level of paginator / single result.
 */
function buildUserMap(
  includes: { users?: UserV2[] } | undefined,
): Map<string, TweetAuthor> {
  const map = new Map<string, TweetAuthor>();
  if (!includes?.users) return map;
  for (const u of includes.users) {
    map.set(u.id, { id: u.id, name: u.name, username: u.username });
  }
  return map;
}

/**
 * Convert a raw TweetV2 + includes into our TweetData shape.
 */
function toTweetData(
  tweet: TweetV2,
  source: TweetData["source"],
  users: Map<string, TweetAuthor>,
): TweetData {
  const author = tweet.author_id ? users.get(tweet.author_id) : undefined;

  // Find parent reply id
  const inReplyTo = tweet.referenced_tweets?.find(
    (ref) => ref.type === "replied_to",
  );

  return {
    id: tweet.id,
    text: tweet.text,
    author,
    createdAt: tweet.created_at,
    publicMetrics: tweet.public_metrics
      ? {
          retweetCount: tweet.public_metrics.retweet_count ?? 0,
          replyCount: tweet.public_metrics.reply_count ?? 0,
          likeCount: tweet.public_metrics.like_count ?? 0,
          quoteCount: tweet.public_metrics.quote_count ?? 0,
        }
      : undefined,
    inReplyToTweetId: inReplyTo?.id,
    conversationId: tweet.conversation_id,
    source,
  };
}

// ── getTimeline ──────────────────────────────────────────────────────────────

/**
 * Fetch the user's Home Timeline (most recent ~20 tweets).
 * Requires user-context auth (OAuth 2.0 PKCE or OAuth 1.0a).
 */
export async function getTimeline(config: Config): Promise<TweetData[]> {
  const client = await getUserClient(config);

  const timeline: TweetHomeTimelineV2Paginator =
    await client.v2.homeTimeline({
      ...API_PARAMS,
      max_results: 20,
    });

  return paginatorToTweets(timeline, "timeline");
}

// ── getMentions ──────────────────────────────────────────────────────────────

/**
 * Fetch @mentions for the authenticated user (most recent ~20).
 * Requires user-context auth (OAuth 2.0 PKCE or OAuth 1.0a).
 */
export async function getMentions(config: Config): Promise<TweetData[]> {
  const client = await getUserClient(config);
  const me = await getMe(config);

  const mentions: TweetUserMentionTimelineV2Paginator =
    await client.v2.userMentionTimeline(me.id, {
      ...API_PARAMS,
      max_results: 20,
    });

  return paginatorToTweets(mentions, "mentions");
}

/**
 * Convert a paginator response to an array of TweetData.
 */
function paginatorToTweets(
  paginator:
    | TweetHomeTimelineV2Paginator
    | TweetUserMentionTimelineV2Paginator,
  source: TweetData["source"],
): TweetData[] {
  const users = buildUserMap(paginator.includes);
  return (paginator.tweets ?? []).map((t) => toTweetData(t, source, users));
}

// ── getTweetContext ──────────────────────────────────────────────────────────

/**
 * Recursively build a context chain for a given tweet:
 *   - Walk up parent chain (replied_to) until root tweet
 *   - Search for replies to the conversation
 *
 * Uses App-only (Bearer) client for tweet lookup and search.
 */
export async function getTweetContext(
  config: Config,
  tweetId: string,
): Promise<TweetContext> {
  const bearer = await getBearerClient(config);

  // Walk up parent chain
  const chainTweets: TweetV2[] = [];
  const chainIncludes: { users?: UserV2[] }[] = [];
  let currentId: string = tweetId;
  let depth = 0;
  const MAX_DEPTH = 10;

  while (currentId && depth < MAX_DEPTH) {
    const result: TweetV2SingleResult = await bearer.v2.singleTweet(
      currentId,
      API_PARAMS,
    );

    chainTweets.push(result.data);
    chainIncludes.push(result.includes ?? {});

    const parent = result.data.referenced_tweets?.find(
      (ref) => ref.type === "replied_to",
    );
    if (!parent) break; // reached root

    currentId = parent.id;
    depth++;
  }

  // chainTweets[0] = original tweet, chainTweets[last] = root
  const root = chainTweets[chainTweets.length - 1];
  const rootConversationId = root.conversation_id ?? root.id;

  // Search for replies to the conversation
  let replies: TweetData[] = [];

  try {
    const searchResult: TweetSearchRecentV2Paginator =
      await bearer.v2.search(
        `conversation_id:${rootConversationId}`,
        {
          ...API_PARAMS,
          max_results: 20,
        },
      );

    const users = buildUserMap(searchResult.includes);
    replies = (searchResult.tweets ?? [])
      .filter((t) => t.id !== tweetId) // exclude the source tweet
      .map((t) => toTweetData(t, "mentions", users));
  } catch {
    // Search may fail (rate limit, etc.) — replies are optional
  }

  // Build user map for the root tweet (use the last chain item's includes)
  const rootUsers = buildUserMap(chainIncludes[chainIncludes.length - 1]);

  return {
    root: toTweetData(root, "search", rootUsers),
    replies,
  };
}

// ── getTrendingPosts ─────────────────────────────────────────────────────────

/**
 * Search for niche-relevant tweets by keywords.
 * Uses App-only Bearer client.
 * Falls back to built-in defaults if no keywords configured.
 */
export async function getTrendingPosts(
  config: Config,
  keywords?: string[],
): Promise<TweetData[]> {
  const bearer = await getBearerClient(config);
  const terms = keywords && keywords.length > 0 ? keywords : getNicheKeywords(config);

  // Build query: OR across keywords, exclude retweets
  const query = `(${terms.map((k) => `"${k}"`).join(" OR ")}) -is:retweet lang:en`;

  const searchResult: TweetSearchRecentV2Paginator = await bearer.v2.search(
    query,
    {
      ...API_PARAMS,
      max_results: 20,
    },
  );

  const users = buildUserMap(searchResult.includes);
  return (searchResult.tweets ?? []).map((t) =>
    toTweetData(t, "search", users),
  );
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
  if (!metrics) return weight; // no metrics → just weight
  const interactions =
    metrics.retweetCount + metrics.replyCount + metrics.likeCount + metrics.quoteCount;
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
  // Resolve API key/secret early to fail fast
  try {
    resolveTwitterApiKey(config);
    resolveTwitterApiSecret(config);
  } catch (err) {
    return {
      tweets: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const result: ListResult = { tweets: [] };

  try {
    // Check if we have any form of user-context auth
    const hasUserTokens =
      !!(resolveOAuth2AccessToken(config)) ||
      !!(
        resolveTwitterAccessToken(config) &&
        resolveTwitterAccessTokenSecret(config)
      );

    const timeline: TweetData[] = [];
    const mentions: TweetData[] = [];
    const trending: TweetData[] = [];

    if (filter === "all" || filter === "timeline") {
      if (hasUserTokens) {
        try {
          const tl = await getTimeline(config);
          timeline.push(...tl);
        } catch {
          // If timeline fails, try trending as fallback
          try {
            const tr = await getTrendingPosts(config);
            trending.push(...tr);
          } catch {
            // Both failed — will report what we have
          }
        }
      } else {
        // No user tokens — use search trending as timeline proxy
        try {
          const tr = await getTrendingPosts(config);
          trending.push(...tr);
        } catch {
          // Search may fail too
        }
      }
    }

    if (filter === "all" || filter === "mentions") {
      if (hasUserTokens) {
        try {
          const mn = await getMentions(config);
          mentions.push(...mn);
        } catch {
          // Mentions failed
        }
      }
    }

    // Merge & sort
    result.tweets = mergeAndSort(timeline, mentions, trending);

    // Enrich mentions with context chain
    if (result.tweets.length > 0 && (filter === "all" || filter === "mentions")) {
      const replyTweets = result.tweets.filter((t) => t.inReplyToTweetId);
      const toEnrich = replyTweets.slice(0, 5); // limit to avoid excessive API calls
      for (const tweet of toEnrich) {
        try {
          const ctx = await getTweetContext(config, tweet.id);
          tweet.context = ctx;
        } catch {
          // Context fetch failed — skip
        }
      }
    }

    // Try to get user info if we have tokens
    if (hasUserTokens) {
      try {
        const me = await getMe(config);
        result.userId = me.id;
      } catch {
        // Not critical
      }
    }
  } catch (err) {
    result.error =
      err instanceof Error ? err.message : "Unknown Twitter API error";
  }

  return result;
}
