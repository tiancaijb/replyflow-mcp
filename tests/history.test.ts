/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock fs ──────────────────────────────────────────────────────────────────
// Hoisted before imports so the history module sees mocked fs

vi.mock("fs", () => {
  const mock = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
  return { ...mock, default: mock };
});

// ── Mock os.homedir() to return a deterministic path ─────────────────────────

vi.mock("os", () => {
  const os = {
    homedir: vi.fn(() => "/home/testuser"),
  };
  return { ...os, default: os };
});

// ── Import after mocks ───────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import {
  appendHistory,
  readHistory,
  getRepliedTweetIds,
  checkForReplies,
  getFollowUpTweets,
  updateEntryStatus,
  markAsFollowedUp,
  HISTORY_PATH,
  HISTORY_DIR,
} from "../src/history.js";
import type { HistoryEntry } from "../src/history.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<HistoryEntry> & { id: number }): HistoryEntry {
  return {
    tweetId: "",
    text: "test",
    copiedAt: "2024-01-01T00:00:00Z",
    account: "default",
    status: "sent",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("history", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: file does not exist (empty history)
    vi.mocked(existsSync).mockReturnValue(false);

    // Ensure homedir() returns the mocked value
    vi.mocked(homedir).mockReturnValue("/home/testuser");
  });

  // ── appendHistory ──────────────────────────────────────────────────────────

  describe("appendHistory", () => {
    it("creates a history entry with correct fields", () => {
      vi.mocked(existsSync).mockReturnValue(false); // no existing file

      const entry = appendHistory("Nice reply!", "123", "curious");

      // Verify entry fields
      expect(entry.id).toBe(1);
      expect(entry.tweetId).toBe("123");
      expect(entry.text).toBe("Nice reply!");
      expect(entry.style).toBe("curious");
      expect(entry.account).toBe("default");
      expect(entry.status).toBe("sent");
      expect(entry.copiedAt).toBeDefined();
      expect(() => new Date(entry.copiedAt)).not.toThrow(); // valid ISO timestamp

      // Verify file write
      expect(writeFileSync).toHaveBeenCalledTimes(1);
      expect(writeFileSync).toHaveBeenCalledWith(
        HISTORY_PATH,
        expect.stringContaining("Nice reply!"),
        "utf-8",
      );
    });

    it("creates the .replyflow directory when it does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      appendHistory("test", "1", "casual");

      expect(mkdirSync).toHaveBeenCalledWith(HISTORY_DIR, { recursive: true });
      expect(writeFileSync).toHaveBeenCalled();
    });

    it("auto-increments ID based on existing entries", () => {
      // Existing file has 3 entries with ids 1, 2, 3
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "old1", copiedAt: "2024-01-01T00:00:00Z" }),
          makeEntry({ id: 2, tweetId: "101", text: "old2", copiedAt: "2024-01-02T00:00:00Z" }),
          makeEntry({ id: 3, tweetId: "102", text: "old3", copiedAt: "2024-01-03T00:00:00Z" }),
        ]),
      );

      const entry = appendHistory("new reply", "200", "supportive");

      expect(entry.id).toBe(4);
      expect(entry.text).toBe("new reply");
    });

    it("supports optional tweetId and style", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const entry = appendHistory("Just a note");

      expect(entry.id).toBe(1);
      expect(entry.tweetId).toBe(""); // defaults to empty string
      expect(entry.style).toBeUndefined();
      expect(entry.account).toBe("default");
      expect(entry.status).toBe("sent");
    });

    it("supports custom account name", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const entry = appendHistory("Hello", "1", "casual", "work");

      expect(entry.account).toBe("work");
    });

    it("supports conversationId and inReplyToTweetId", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const entry = appendHistory("Hello", "1", "casual", "default", "conv-123", "parent-456");

      expect(entry.conversationId).toBe("conv-123");
      expect(entry.inReplyToTweetId).toBe("parent-456");
      expect(entry.tweetId).toBe("1");
      expect(entry.status).toBe("sent");
    });

    it("appends to existing history instead of overwriting", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "existing", copiedAt: "2024-01-01T00:00:00Z" }),
        ]),
      );

      const entry = appendHistory("new", "200", "curious");

      expect(entry.id).toBe(2);

      // writeFileSync should contain both entries
      const writtenContent: string = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe(1);
      expect(parsed[0].text).toBe("existing");
      expect(parsed[1].id).toBe(2);
      expect(parsed[1].text).toBe("new");
    });

    it("handles corrupt history file gracefully", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("not valid json {{{");

      const entry = appendHistory("recovery test", "1", "curious");

      // Should start fresh with id 1
      expect(entry.id).toBe(1);
      expect(entry.text).toBe("recovery test");
    });

    it("handles readFileSync throwing", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("permission denied");
      });

      const entry = appendHistory("error recovery", "1", "casual");

      expect(entry.id).toBe(1);
      expect(entry.text).toBe("error recovery");
    });
  });

  // ── readHistory ──────────────────────────────────────────────────────────

  describe("readHistory", () => {
    it("returns entries sorted newest first", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "oldest", copiedAt: "2024-01-01T00:00:00Z" }),
          makeEntry({ id: 2, tweetId: "101", text: "newest", copiedAt: "2024-12-31T00:00:00Z" }),
          makeEntry({ id: 3, tweetId: "102", text: "middle", copiedAt: "2024-06-15T00:00:00Z" }),
        ]),
      );

      const entries = readHistory();

      expect(entries).toHaveLength(3);
      expect(entries[0].id).toBe(2); // newest first
      expect(entries[1].id).toBe(3); // middle
      expect(entries[2].id).toBe(1); // oldest
    });

    it("filters by tweetId when provided", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "alpha", copiedAt: "2024-01-01T00:00:00Z" }),
          makeEntry({ id: 2, tweetId: "200", text: "bravo", copiedAt: "2024-02-01T00:00:00Z" }),
          makeEntry({ id: 3, tweetId: "100", text: "charlie", copiedAt: "2024-03-01T00:00:00Z" }),
        ]),
      );

      const entries = readHistory("100");

      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.tweetId === "100")).toBe(true);
    });

    it("filters by status when provided", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "sent1", status: "sent" }),
          makeEntry({ id: 2, tweetId: "101", text: "replied1", status: "replied" }),
          makeEntry({ id: 3, tweetId: "102", text: "sent2", status: "sent" }),
          makeEntry({ id: 4, tweetId: "103", text: "followed", status: "followed_up" }),
        ]),
      );

      const sent = readHistory(undefined, 20, "sent");
      expect(sent).toHaveLength(2);
      expect(sent.every((e) => e.status === "sent")).toBe(true);

      const replied = readHistory(undefined, 20, "replied");
      expect(replied).toHaveLength(1);
      expect(replied[0].id).toBe(2);

      const followed = readHistory(undefined, 20, "followed_up");
      expect(followed).toHaveLength(1);
      expect(followed[0].id).toBe(4);
    });

    it("filters by both tweetId and status simultaneously", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "a", status: "sent" }),
          makeEntry({ id: 2, tweetId: "100", text: "b", status: "replied" }),
          makeEntry({ id: 3, tweetId: "200", text: "c", status: "sent" }),
        ]),
      );

      const entries = readHistory("100", 20, "sent");
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(1);
    });

    it("respects limit parameter", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify(
          Array.from({ length: 50 }, (_, i) => ({
            ...makeEntry({
              id: i + 1,
              tweetId: `${i + 1}`,
              text: `entry ${i + 1}`,
              copiedAt: new Date(2024, 0, i + 1).toISOString(),
            }),
          })),
        ),
      );

      const entries = readHistory(undefined, 10);

      expect(entries).toHaveLength(10);
      // Newest first (highest id since dates are ascending)
      expect(entries[0].id).toBe(50);
      expect(entries[9].id).toBe(41);
    });

    it("returns empty array when no history file exists", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const entries = readHistory();

      expect(entries).toEqual([]);
      expect(readFileSync).not.toHaveBeenCalled();
    });

    it("returns empty array when history file is empty array", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("[]");

      const entries = readHistory();

      expect(entries).toEqual([]);
    });

    it("returns empty array when history file is corrupt", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("corrupt json {{{");

      const entries = readHistory();

      expect(entries).toEqual([]);
    });

    it("uses default limit of 20", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify(
          Array.from({ length: 30 }, (_, i) => ({
            ...makeEntry({
              id: i + 1,
              tweetId: `${i + 1}`,
              text: `entry ${i + 1}`,
              copiedAt: new Date(2024, 0, i + 1).toISOString(),
            }),
          })),
        ),
      );

      const entries = readHistory();

      expect(entries).toHaveLength(20);
    });

    it("returns empty array when filtering by non-existent tweetId", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "alpha", copiedAt: "2024-01-01T00:00:00Z" }),
        ]),
      );

      const entries = readHistory("999");

      expect(entries).toEqual([]);
    });
  });

  // ── getRepliedTweetIds ──────────────────────────────────────────────────

  describe("getRepliedTweetIds", () => {
    it("returns set of unique tweet IDs that have been replied to", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "reply a", copiedAt: "2024-01-01T00:00:00Z" }),
          makeEntry({ id: 2, tweetId: "200", text: "reply b", copiedAt: "2024-02-01T00:00:00Z" }),
          makeEntry({ id: 3, tweetId: "100", text: "reply c", copiedAt: "2024-03-01T00:00:00Z" }),
          makeEntry({ id: 4, tweetId: "300", text: "reply d", copiedAt: "2024-04-01T00:00:00Z" }),
        ]),
      );

      const ids = getRepliedTweetIds();

      expect(ids.size).toBe(3);
      expect(ids.has("100")).toBe(true);
      expect(ids.has("200")).toBe(true);
      expect(ids.has("300")).toBe(true);
      expect(ids.has("400")).toBe(false);
    });

    it("filters out empty tweetId strings", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "valid", copiedAt: "2024-01-01T00:00:00Z" }),
          makeEntry({ id: 2, tweetId: "", text: "empty id", copiedAt: "2024-02-01T00:00:00Z" }),
          makeEntry({ id: 3, tweetId: "200", text: "valid", copiedAt: "2024-03-01T00:00:00Z" }),
        ]),
      );

      const ids = getRepliedTweetIds();

      expect(ids.size).toBe(2);
      expect(ids.has("100")).toBe(true);
      expect(ids.has("200")).toBe(true);
    });

    it("returns empty set when no history file exists", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const ids = getRepliedTweetIds();

      expect(ids.size).toBe(0);
    });

    it("returns empty set when history file is empty", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("[]");

      const ids = getRepliedTweetIds();

      expect(ids.size).toBe(0);
    });

    it("returns empty set when file is corrupt", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("{{{ bad json }}}");

      const ids = getRepliedTweetIds();

      expect(ids.size).toBe(0);
    });
  });

  // ── checkForReplies ─────────────────────────────────────────────────────

  describe("checkForReplies", () => {
    it("returns empty array when no sent entries exist", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "already replied", status: "replied" }),
        ]),
      );

      const updated = checkForReplies(() => null);

      expect(updated).toEqual([]);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("returns empty array when thread fetcher returns null", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "my reply", status: "sent" }),
        ]),
      );

      const updated = checkForReplies(() => null);

      expect(updated).toEqual([]);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("marks entry as replied when external replies are found", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "my reply", status: "sent" }),
        ]),
      );

      const mockFetcher = () => ({
        authorId: "author-1",   // original tweet author
        replies: [
          { authorId: "other-user" },  // reply from someone else
        ],
      });

      const updated = checkForReplies(mockFetcher);

      expect(updated).toHaveLength(1);
      expect(updated[0].id).toBe(1);
      expect(updated[0].status).toBe("replied");

      // Verify write was called with updated status
      expect(writeFileSync).toHaveBeenCalledTimes(1);
      const writtenContent = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
      expect(writtenContent[0].status).toBe("replied");
    });

    it("does not mark when replies are only from original author", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "my reply", status: "sent" }),
        ]),
      );

      const mockFetcher = () => ({
        authorId: "author-1",
        replies: [
          { authorId: "author-1" },  // original author replying to own thread
        ],
      });

      const updated = checkForReplies(mockFetcher);

      expect(updated).toEqual([]);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("does not mark when replies are only from the authenticated user", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "my reply", status: "sent" }),
        ]),
      );

      const mockFetcher = () => ({
        authorId: "author-1",
        replies: [
          { authorId: "me" },  // our own reply (we are the authenticated user)
        ],
      });

      const updated = checkForReplies(mockFetcher, "me");

      expect(updated).toEqual([]);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("handles multiple sent entries and only updates those with replies", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const entries = [
        makeEntry({ id: 1, tweetId: "100", text: "got reply", status: "sent" }),
        makeEntry({ id: 2, tweetId: "200", text: "no reply", status: "sent" }),
        makeEntry({ id: 3, tweetId: "300", text: "also reply", status: "sent" }),
        makeEntry({ id: 4, tweetId: "400", text: "already done", status: "followed_up" }),
      ];
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(entries));

      let callCount = 0;
      const mockFetcher = () => {
        callCount++;
        if (callCount === 1) {
          return { authorId: "author-1", replies: [{ authorId: "other" }] };
        }
        if (callCount === 2) {
          return { authorId: "author-2", replies: [] }; // no replies
        }
        return { authorId: "author-3", replies: [{ authorId: "stranger" }] };
      };

      const updated = checkForReplies(mockFetcher);

      expect(updated).toHaveLength(2);
      expect(updated.map((e) => e.id).sort()).toEqual([1, 3]);

      // Verify write was called
      expect(writeFileSync).toHaveBeenCalledTimes(1);
    });

    it("skips sent entries without a tweetId", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "", text: "no tweet id", status: "sent" }),
          makeEntry({ id: 2, tweetId: "200", text: "has tweet id", status: "sent" }),
        ]),
      );

      let fetcherCalled = false;
      const mockFetcher = (tweetId: string) => {
        fetcherCalled = true;
        expect(tweetId).toBe("200"); // only called for entry with tweetId
        return { authorId: "author-1", replies: [{ authorId: "other" }] };
      };

      const updated = checkForReplies(mockFetcher);
      expect(updated).toHaveLength(1);
      expect(updated[0].id).toBe(2);
      expect(fetcherCalled).toBe(true);
    });
  });

  // ── getFollowUpTweets ────────────────────────────────────────────────────

  describe("getFollowUpTweets", () => {
    it("returns only entries with status 'replied' sorted newest first", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "sent", status: "sent", copiedAt: "2024-01-01T00:00:00Z" }),
          makeEntry({ id: 2, tweetId: "101", text: "replied old", status: "replied", copiedAt: "2024-02-01T00:00:00Z" }),
          makeEntry({ id: 3, tweetId: "102", text: "followed up", status: "followed_up", copiedAt: "2024-03-01T00:00:00Z" }),
          makeEntry({ id: 4, tweetId: "103", text: "replied new", status: "replied", copiedAt: "2024-04-01T00:00:00Z" }),
        ]),
      );

      const followUps = getFollowUpTweets();

      expect(followUps).toHaveLength(2);
      expect(followUps[0].id).toBe(4); // newest
      expect(followUps[1].id).toBe(2); // older
    });

    it("returns empty array when no replied entries", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "sent", status: "sent" }),
          makeEntry({ id: 2, tweetId: "101", text: "followed", status: "followed_up" }),
        ]),
      );

      expect(getFollowUpTweets()).toEqual([]);
    });

    it("returns empty array when no history", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      expect(getFollowUpTweets()).toEqual([]);
    });
  });

  // ── updateEntryStatus ─────────────────────────────────────────────────────

  describe("updateEntryStatus", () => {
    it("updates status of an existing entry", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "test", status: "replied" }),
        ]),
      );

      const updated = updateEntryStatus(1, "followed_up");

      expect(updated).toBeDefined();
      expect(updated!.id).toBe(1);
      expect(updated!.status).toBe("followed_up");

      // Verify write
      expect(writeFileSync).toHaveBeenCalledTimes(1);
      const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
      expect(written[0].status).toBe("followed_up");
    });

    it("returns undefined for non-existent entry", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "test", status: "sent" }),
        ]),
      );

      const updated = updateEntryStatus(999, "followed_up");

      expect(updated).toBeUndefined();
      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });

  // ── markAsFollowedUp ──────────────────────────────────────────────────────

  describe("markAsFollowedUp", () => {
    it("marks a replied entry as followed_up", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          makeEntry({ id: 1, tweetId: "100", text: "test", status: "replied" }),
        ]),
      );

      const result = markAsFollowedUp(1);

      expect(result).toBeDefined();
      expect(result!.status).toBe("followed_up");
    });

    it("returns undefined for non-existent entry", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("[]");

      expect(markAsFollowedUp(99)).toBeUndefined();
    });
  });

  // ── Paths ─────────────────────────────────────────────────────────────────

  describe("paths", () => {
    it("uses homedir() for HISTORY_DIR", () => {
      expect(HISTORY_DIR).toBe("/home/testuser/.replyflow");
    });

    it("constructs HISTORY_PATH correctly", () => {
      expect(HISTORY_PATH).toBe("/home/testuser/.replyflow/history.json");
    });
  });
});
