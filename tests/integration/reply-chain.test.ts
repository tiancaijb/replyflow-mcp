/// <reference types="vitest/globals" />

/**
 * Integration test: reply chain tracking flow.
 *
 * Tests the full lifecycle: send reply → check for new replies → follow up.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mkdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

// ── Enable mock CLI ──────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.REPLYFLOW_MOCK_CLI = "true";
});

// ── Isolate config via a temporary directory ─────────────────────────────────

const { TEST_HOME } = vi.hoisted(() => ({
  TEST_HOME: "/tmp/test-replyflow-reply-chain",
}));

const TEST_CONFIG_DIR = join(TEST_HOME, ".replyflow");
const TEST_HISTORY_PATH = join(TEST_CONFIG_DIR, "history.json");

vi.mock("os", () => ({
  homedir: vi.fn(() => TEST_HOME),
  default: { homedir: vi.fn(() => TEST_HOME) },
}));

beforeEach(() => {
  if (!existsSync(TEST_CONFIG_DIR)) {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  }
});

afterEach(() => {
  try {
    if (existsSync(TEST_HISTORY_PATH)) unlinkSync(TEST_HISTORY_PATH);
  } catch {
    // ignore
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("reply chain tracking", () => {
  it("tracks sent → replied → followed_up lifecycle", async () => {
    const { appendHistory, checkForReplies, getFollowUpTweets, updateEntryStatus } =
      await import("../../src/history.js");
    const { getTweetWithReplies } = await import("../../src/twitter.js");

    // ── 1. Create a sent entry ───────────────────────────────────────
    const entry = appendHistory(
      "Thanks for sharing this! I built something similar.",
      "tweet-thread-1", // matches fixture tweet.json
      "casual",
      "testaccount",
    );

    expect(entry.status).toBe("sent");
    expect(entry.tweetId).toBe("tweet-thread-1");

    // ── 2. Check for replies (simulate) ─────────────────────────────
    // The tweet fixture has replies from "otheruser" (not original author, not us)
    // We pass a custom getThread to simulate the check

    const mockThread = {
      authorId: "author-1",
      replies: [
        { authorId: "other-user" },
      ],
    };

    const updated = checkForReplies(
      () => mockThread,
      "me-user-id", // our user ID
    );

    expect(updated.length).toBe(1);
    expect(updated[0].id).toBe(entry.id);
    expect(updated[0].status).toBe("replied");

    // ── 3. Get follow-up tweets ─────────────────────────────────────
    const followUps = getFollowUpTweets();
    expect(followUps.length).toBe(1);
    expect(followUps[0].id).toBe(entry.id);
    expect(followUps[0].status).toBe("replied");

    // ── 4. Mark as followed up ──────────────────────────────────────
    const { markAsFollowedUp } = await import("../../src/history.js");
    const marked = markAsFollowedUp(entry.id);

    expect(marked).toBeDefined();
    expect(marked!.status).toBe("followed_up");

    // Verify no more follow-ups
    const remaining = getFollowUpTweets();
    expect(remaining.length).toBe(0);
  });

  it("filters out our own replies when checking for new replies", async () => {
    const { appendHistory, checkForReplies, getFollowUpTweets } =
      await import("../../src/history.js");

    // Create a sent entry for a tweet where only "me" replied
    const entry = appendHistory(
      "Great post!",
      "tweet-only-own-replies",
      "supportive",
      "me",
    );

    // Mock thread where the only reply is from us
    const mockThread = {
      authorId: "author-1",
      replies: [
        { authorId: "me-user-id" }, // our own reply
      ],
    };

    const updated = checkForReplies(
      () => mockThread,
      "me-user-id",
    );

    // No external replies → no status change
    expect(updated.length).toBe(0);

    const followUps = getFollowUpTweets();
    expect(followUps.length).toBe(0);
  });

  it("handles errors gracefully when tweet thread is not found", async () => {
    const { appendHistory, checkForReplies } =
      await import("../../src/history.js");

    appendHistory(
      "Nice work!",
      "non-existent-tweet",
      "curious",
      "test",
    );

    // getThread returns null (tweet not found)
    const updated = checkForReplies(
      () => null,
      "me-user-id",
    );

    expect(updated.length).toBe(0);
  });

  it("does not change status for tweets without new replies", async () => {
    const { appendHistory, checkForReplies, getFollowUpTweets } =
      await import("../../src/history.js");

    appendHistory(
      "Interesting perspective!",
      "tweet-no-replies",
      "thoughtful",
      "test",
    );

    // Mock thread with no replies at all
    const mockThread = {
      authorId: "author-1",
      replies: [],
    };

    const updated = checkForReplies(
      () => mockThread,
      "me-user-id",
    );

    expect(updated.length).toBe(0);

    const followUps = getFollowUpTweets();
    expect(followUps.length).toBe(0);
  });
});
