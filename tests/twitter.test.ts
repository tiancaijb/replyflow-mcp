/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock child_process so we can control spawnSync ──────────────────────────

vi.mock("child_process", () => {
  const spawnSync = vi.fn();
  return {
    spawnSync,
    default: { spawnSync },
  };
});

// ── Note ─────────────────────────────────────────────────────────────────────
// mergeAndSort is the only pure function in twitter.ts.
// Other functions call twitter-cli and are tested via integration.
// Here we test mergeAndSort thoroughly, plus error scenarios via mocked CLI.

import { spawnSync } from "child_process";
import { mergeAndSort, getTrendingPosts, getTweetWithReplies } from "../src/twitter.js";
import { cache } from "../src/cache.js";
import type { TweetData } from "../src/twitter.js";
import type { Config } from "../src/config.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTweet(
  id: string,
  overrides: Partial<TweetData> = {},
): TweetData {
  return {
    id,
    text: `Tweet ${id}`,
    source: "search",
    ...overrides,
  };
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    nicheKeywords: ["test keyword"],
    replyStyle: "curious",
    ...overrides,
  };
}

/**
 * Build a fake spawnSync return representing a successful twitter search.
 */
function makeSearchResult(tweets: Array<{ id: string; text: string }> = []): ReturnType<typeof spawnSync> {
  return {
    pid: 123,
    output: [],
    stdout: JSON.stringify({
      ok: true,
      schema_version: "1",
      data: tweets.map((t) => ({
        id: t.id,
        text: t.text,
        author: { id: "u1", name: "Test", screenName: "testuser" },
        metrics: { likes: 10, retweets: 5, replies: 2, quotes: 1, views: 100, bookmarks: 3 },
        createdAt: "2024-01-01T00:00:00.000Z",
        createdAtLocal: "2024-01-01 00:00",
        createdAtISO: "2024-01-01T00:00:00.000Z",
        media: [],
        urls: [],
        isRetweet: false,
        retweetedBy: null,
        lang: "en",
        score: null,
      })),
    }),
    stderr: "",
    status: 0,
    signal: null,
    error: null,
  };
}

/**
 * Build a fake spawnSync error return.
 */
function makeErrorResult(error: Error, stderr = "", status: number | null = null, signal: string | null = null): ReturnType<typeof spawnSync> {
  return {
    pid: 0,
    output: [],
    stdout: "",
    stderr,
    status,
    signal,
    error,
  };
}

/**
 * Build a fake spawnSync non-zero exit return.
 */
function makeExitResult(exitCode: number, stderr = ""): ReturnType<typeof spawnSync> {
  return {
    pid: 123,
    output: [],
    stdout: "",
    stderr,
    status: exitCode,
    signal: null,
    error: null,
  };
}

/**
 * Build a fake spawnSync timeout return.
 */
function makeTimeoutResult(): ReturnType<typeof spawnSync> {
  return {
    pid: 0,
    output: [],
    stdout: "",
    stderr: "",
    status: null,
    signal: "SIGTERM",
    error: null,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("twitter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear(); // Clear singleton cache to avoid cross-test contamination
  });

  describe("mergeAndSort", () => {
    it("merges multiple arrays and deduplicates by id", () => {
      const a = makeTweet("1");
      const b = makeTweet("2");
      const c = makeTweet("1"); // duplicate of a

      const result = mergeAndSort([a, c], [b]);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["1", "2"]);
    });

    it("sorts by interaction count descending", () => {
      const low = makeTweet("1", {
        publicMetrics: {
          retweetCount: 5,
          replyCount: 2,
          likeCount: 10,
          quoteCount: 1,
        },
      });
      const high = makeTweet("2", {
        publicMetrics: {
          retweetCount: 50,
          replyCount: 20,
          likeCount: 100,
          quoteCount: 10,
        },
      });

      const result = mergeAndSort([low, high]);

      expect(result[0].id).toBe("2");
      expect(result[1].id).toBe("1");
    });

    it("preserves insertion order when metrics are equal or missing", () => {
      const a = makeTweet("1");
      const b = makeTweet("2");

      const result = mergeAndSort([a, b]);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("2");
    });

    it("handles empty input", () => {
      const result = mergeAndSort([], [], []);
      expect(result).toEqual([]);
    });

    it("handles single array", () => {
      const a = makeTweet("1");
      const b = makeTweet("2");
      const result = mergeAndSort([a, b]);
      expect(result).toHaveLength(2);
    });

    it("preserves all fields on merged tweets", () => {
      const tweet = makeTweet("1", {
        text: "Hello world",
        author: { id: "u1", name: "Alice", username: "alice" },
        createdAt: "2024-01-01T00:00:00Z",
        publicMetrics: {
          retweetCount: 10,
          replyCount: 5,
          likeCount: 20,
          quoteCount: 2,
        },
        inReplyToTweetId: "0",
        conversationId: "conv1",
      });

      const result = mergeAndSort([tweet]);

      expect(result[0]).toMatchObject({
        id: "1",
        text: "Hello world",
        author: { id: "u1", name: "Alice", username: "alice" },
        source: "search",
        inReplyToTweetId: "0",
        conversationId: "conv1",
      });
    });
  });

  // ── Error scenario tests ────────────────────────────────────────────────
  //
  // These test getTrendingPosts and getTweetWithReplies with mocked
  // spawnSync to simulate error conditions.

  describe("getTrendingPosts error handling", () => {
    it("returns empty array when spawnSync throws auth error (no retry)", () => {
      vi.mocked(spawnSync).mockReturnValue(makeExitResult(401, "Unauthorized"));

      const result = getTrendingPosts(makeConfig());

      expect(result).toEqual([]);
      // Auth errors are not retried — spawnSync called exactly once
      expect(spawnSync).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when spawnSync throws timeout (no retry)", () => {
      vi.mocked(spawnSync).mockReturnValue(makeTimeoutResult());

      const result = getTrendingPosts(makeConfig());

      expect(result).toEqual([]);
      // Timeout is not retried
      expect(spawnSync).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when spawnSync throws rate-limit (no retry)", () => {
      vi.mocked(spawnSync).mockReturnValue(makeExitResult(429, "rate limit exceeded"));

      const result = getTrendingPosts(makeConfig());

      expect(result).toEqual([]);
      // Rate limit is not retried
      expect(spawnSync).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when spawnSync has parse error (no retry)", () => {
      vi.mocked(spawnSync).mockReturnValue({
        pid: 123,
        output: [],
        stdout: "not valid json",
        stderr: "",
        status: 0,
        signal: null,
        error: null,
      });

      const result = getTrendingPosts(makeConfig());

      expect(result).toEqual([]);
      // Parse error is not retried
      expect(spawnSync).toHaveBeenCalledTimes(1);
    });

    it("retries on network error (ECONNRESET) up to 3 times", () => {
      const netErr = new Error("connect ECONNRESET");
      (netErr as NodeJS.ErrnoException).code = "ECONNRESET";
      vi.mocked(spawnSync).mockReturnValue(makeErrorResult(netErr));

      const result = getTrendingPosts(makeConfig());

      expect(result).toEqual([]);
      // Network error: retried 2 times → total 3 calls
      expect(spawnSync).toHaveBeenCalledTimes(3);
    });

    it("recovers from transient network error on retry", () => {
      const netErr = new Error("connect ECONNRESET");
      (netErr as NodeJS.ErrnoException).code = "ECONNRESET";

      const successResult = makeSearchResult([{ id: "t1", text: "Hello world" }]);

      // First call fails with network error, second call succeeds
      vi.mocked(spawnSync)
        .mockReturnValueOnce(makeErrorResult(netErr))
        .mockReturnValueOnce(successResult);

      const result = getTrendingPosts(makeConfig());

      // Should have recovered and returned tweets
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("t1");
      expect(spawnSync).toHaveBeenCalledTimes(2);
    });

    it("does not retry on generic non-zero exit", () => {
      vi.mocked(spawnSync).mockReturnValue(makeExitResult(1, "some error"));

      const result = getTrendingPosts(makeConfig());

      expect(result).toEqual([]);
      // Generic exit error is not retried
      expect(spawnSync).toHaveBeenCalledTimes(1);
    });

    it("calls spawnSync with correct timeout argument", () => {
      vi.mocked(spawnSync).mockReturnValue(makeSearchResult([]));

      getTrendingPosts(makeConfig());

      expect(spawnSync).toHaveBeenCalledWith(
        "twitter",
        expect.any(Array),
        expect.objectContaining({ timeout: 30000 }),
      );
    });
  });

  describe("getTweetWithReplies error handling", () => {
    it("returns empty array on spawn error", () => {
      const err = new Error("spawn twitter ENOENT");
      (err as NodeJS.ErrnoException).code = "ENOENT";
      vi.mocked(spawnSync).mockReturnValue({
        pid: 0,
        output: [],
        stdout: "",
        stderr: "",
        status: null,
        signal: null,
        error: err,
      });

      const result = getTweetWithReplies("123");

      expect(result).toEqual([]);
      // ENOENT (command not found) is NOT a network error → no retry
      expect(spawnSync).toHaveBeenCalledTimes(1);
    });

    it("returns empty array on auth error", () => {
      vi.mocked(spawnSync).mockReturnValue(makeExitResult(403, "Forbidden"));

      const result = getTweetWithReplies("123");

      expect(result).toEqual([]);
      expect(spawnSync).toHaveBeenCalledTimes(1);
    });

    it("returns empty array on timeout", () => {
      vi.mocked(spawnSync).mockReturnValue(makeTimeoutResult());

      const result = getTweetWithReplies("123");

      expect(result).toEqual([]);
      expect(spawnSync).toHaveBeenCalledTimes(1);
    });

    it("calls twitter tweet with tweet ID", () => {
      vi.mocked(spawnSync).mockReturnValue({
        pid: 123,
        output: [],
        stdout: JSON.stringify({ ok: true, schema_version: "1", data: [] }),
        stderr: "",
        status: 0,
        signal: null,
        error: null,
      });

      getTweetWithReplies("tweet-456");

      expect(spawnSync).toHaveBeenCalledWith(
        "twitter",
        expect.arrayContaining(["tweet-456"]),
        expect.any(Object),
      );
    });
  });
});
