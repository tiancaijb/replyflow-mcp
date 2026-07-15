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
  HISTORY_PATH,
  HISTORY_DIR,
} from "../src/history.js";
import type { HistoryEntry } from "../src/history.js";

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
          { id: 1, tweetId: "100", text: "old1", copiedAt: "2024-01-01T00:00:00Z", account: "default" },
          { id: 2, tweetId: "101", text: "old2", copiedAt: "2024-01-02T00:00:00Z", account: "default" },
          { id: 3, tweetId: "102", text: "old3", copiedAt: "2024-01-03T00:00:00Z", account: "default" },
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
    });

    it("supports custom account name", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const entry = appendHistory("Hello", "1", "casual", "work");

      expect(entry.account).toBe("work");
    });

    it("appends to existing history instead of overwriting", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify([
          { id: 1, tweetId: "100", text: "existing", copiedAt: "2024-01-01T00:00:00Z", account: "default" },
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
          { id: 1, tweetId: "100", text: "oldest", copiedAt: "2024-01-01T00:00:00Z", account: "default" },
          { id: 2, tweetId: "101", text: "newest", copiedAt: "2024-12-31T00:00:00Z", account: "default" },
          { id: 3, tweetId: "102", text: "middle", copiedAt: "2024-06-15T00:00:00Z", account: "default" },
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
          { id: 1, tweetId: "100", text: "alpha", copiedAt: "2024-01-01T00:00:00Z", account: "default" },
          { id: 2, tweetId: "200", text: "bravo", copiedAt: "2024-02-01T00:00:00Z", account: "default" },
          { id: 3, tweetId: "100", text: "charlie", copiedAt: "2024-03-01T00:00:00Z", account: "default" },
        ]),
      );

      const entries = readHistory("100");

      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.tweetId === "100")).toBe(true);
    });

    it("respects limit parameter", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify(
          Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            tweetId: `${i + 1}`,
            text: `entry ${i + 1}`,
            copiedAt: new Date(2024, 0, i + 1).toISOString(),
            account: "default",
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
            id: i + 1,
            tweetId: `${i + 1}`,
            text: `entry ${i + 1}`,
            copiedAt: new Date(2024, 0, i + 1).toISOString(),
            account: "default",
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
          { id: 1, tweetId: "100", text: "alpha", copiedAt: "2024-01-01T00:00:00Z", account: "default" },
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
          { id: 1, tweetId: "100", text: "reply a", copiedAt: "2024-01-01T00:00:00Z", account: "default" },
          { id: 2, tweetId: "200", text: "reply b", copiedAt: "2024-02-01T00:00:00Z", account: "default" },
          { id: 3, tweetId: "100", text: "reply c", copiedAt: "2024-03-01T00:00:00Z", account: "default" },
          { id: 4, tweetId: "300", text: "reply d", copiedAt: "2024-04-01T00:00:00Z", account: "default" },
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
          { id: 1, tweetId: "100", text: "valid", copiedAt: "2024-01-01T00:00:00Z", account: "default" },
          { id: 2, tweetId: "", text: "empty id", copiedAt: "2024-02-01T00:00:00Z", account: "default" },
          { id: 3, tweetId: "200", text: "valid", copiedAt: "2024-03-01T00:00:00Z", account: "default" },
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
