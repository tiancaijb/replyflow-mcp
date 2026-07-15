/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Note ─────────────────────────────────────────────────────────────────────
// mergeAndSort is the only pure function in twitter.ts.
// Other functions call twitter-cli and are tested via integration.
// Here we test mergeAndSort thoroughly.

import { mergeAndSort } from "../src/twitter.js";
import type { TweetData } from "../src/twitter.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTweet(
  id: string,
  overrides: Partial<TweetData> = {},
): TweetData {
  return {
    id,
    text: `Tweet ${id}`,
    source: "timeline",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("twitter", () => {
  describe("mergeAndSort", () => {
    it("merges multiple sources and deduplicates by id", () => {
      const a = makeTweet("1", { source: "timeline" });
      const b = makeTweet("2", { source: "mentions" });
      const c = makeTweet("1", { source: "search" }); // duplicate of a

      const result = mergeAndSort([a, c], [b]);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["2", "1"]);
    });

    it("sorts by interaction score descending", () => {
      const low = makeTweet("1", {
        source: "timeline",
        publicMetrics: {
          retweetCount: 5,
          replyCount: 2,
          likeCount: 10,
          quoteCount: 1,
        },
      });
      const high = makeTweet("2", {
        source: "mentions",
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

    it("gives weight to source type when metrics are equal", () => {
      // Both have same metrics, but "mentions" (weight 3) > "timeline" (weight 1)
      const timeline = makeTweet("1", {
        source: "timeline",
        publicMetrics: {
          retweetCount: 0,
          replyCount: 0,
          likeCount: 0,
          quoteCount: 0,
        },
      });
      const mention = makeTweet("2", {
        source: "mentions",
        publicMetrics: {
          retweetCount: 0,
          replyCount: 0,
          likeCount: 0,
          quoteCount: 0,
        },
      });

      const result = mergeAndSort([timeline, mention]);

      expect(result[0].id).toBe("2"); // mentions first (weight 3 > 1)
      expect(result[1].id).toBe("1");
    });

    it("uses source weight when metrics are undefined", () => {
      const search = makeTweet("1", { source: "search" }); // weight 1.5
      const timeline = makeTweet("2", { source: "timeline" }); // weight 1

      const result = mergeAndSort([timeline, search]);

      expect(result[0].id).toBe("1"); // search (1.5) > timeline (1)
      expect(result[1].id).toBe("2");
    });

    it("handles empty input", () => {
      const result = mergeAndSort([], [], []);
      expect(result).toEqual([]);
    });

    it("handles single source", () => {
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
        source: "mentions",
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
        source: "mentions",
        inReplyToTweetId: "0",
        conversationId: "conv1",
      });
    });
  });
});
