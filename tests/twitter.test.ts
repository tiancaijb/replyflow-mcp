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
    source: "search",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("twitter", () => {
  describe("mergeAndSort", () => {
    it("merges multiple arrays and deduplicates by id", () => {
      const a = makeTweet("1");
      const b = makeTweet("2");
      const c = makeTweet("1"); // duplicate of a

      const result = mergeAndSort([a, c], [b]);

      expect(result).toHaveLength(2);
      // Both have no metrics so insertion order is preserved
      // a (id:1) from first batch, then b (id:2) from second batch
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
});
