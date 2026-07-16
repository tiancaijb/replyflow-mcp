/// <reference types="vitest/globals" />

/**
 * Integration test: config → search → copy reply → history.
 *
 * Uses REPLYFLOW_MOCK_CLI=true to simulate twitter-cli responses
 * from fixture files, with real modules under test.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mkdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

// ── Enable mock CLI ──────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.REPLYFLOW_MOCK_CLI = "true";
});

// ── Isolate config via a temporary directory ─────────────────────────────────

import type { Config } from "../../src/config.js";

const { TEST_HOME } = vi.hoisted(() => ({
  TEST_HOME: "/tmp/test-replyflow-config-history",
}));

const TEST_CONFIG_DIR = join(TEST_HOME, ".replyflow");
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, "config.json");
const TEST_HISTORY_PATH = join(TEST_CONFIG_DIR, "history.json");

vi.mock("os", () => ({
  homedir: vi.fn(() => TEST_HOME),
  default: { homedir: vi.fn(() => TEST_HOME) },
}));

beforeEach(() => {
  // Ensure clean test directory
  if (!existsSync(TEST_CONFIG_DIR)) {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  }
});

afterEach(() => {
  // Clean up test config
  try {
    if (existsSync(TEST_CONFIG_PATH)) unlinkSync(TEST_CONFIG_PATH);
    if (existsSync(TEST_HISTORY_PATH)) unlinkSync(TEST_HISTORY_PATH);
  } catch {
    // ignore
  }
});

// ── Tests (lazy imports so mocks take effect) ────────────────────────────────

describe("config → search → copy → history flow", () => {
  it("configures a project, searches, copies reply, and retrieves history", async () => {
    const { updateEffectiveConfig, getEffectiveConfig } = await import(
      "../../src/config.js"
    );

    // ── 1. Configure a project ───────────────────────────────────────
    const config: Partial<Config> = {
      activeProject: "MyTestProject",
      projects: {
        MyTestProject: {
          name: "My Test Project",
          description: "A test project",
          url: "https://test.example.com",
          keywords: ["indie dev", "saas"],
        },
      },
      replyStyle: "curious",
    };

    updateEffectiveConfig(config);

    // Verify config was saved
    const savedConfig = getEffectiveConfig();
    expect(savedConfig.activeProject).toBe("MyTestProject");
    expect(savedConfig.projects?.MyTestProject?.keywords).toEqual(["indie dev", "saas"]);

    // ── 2. Search for tweets ─────────────────────────────────────────
    const { list } = await import("../../src/twitter.js");
    const result = await list(savedConfig);

    expect(result.error).toBeUndefined();
    expect(result.tweets).toBeDefined();
    expect(result.tweets.length).toBeGreaterThan(0);
    expect(result.tweets[0]).toHaveProperty("id");
    expect(result.tweets[0]).toHaveProperty("text");
    expect(result.tweets[0].source).toBe("search");

    // Should include user info
    expect(result.userId).toBeDefined();

    // ── 3. Copy a reply (simulate) ───────────────────────────────────
    const { appendHistory, readHistory } = await import(
      "../../src/history.js"
    );

    const tweetId = result.tweets[0].id;
    const replyText = "Great work! Keep building.";

    const entry = appendHistory(
      replyText,
      tweetId,
      "curious",
      "default",
      result.tweets[0].conversationId,
    );

    expect(entry.text).toBe(replyText);
    expect(entry.tweetId).toBe(tweetId);
    expect(entry.status).toBe("sent");

    // ── 4. Retrieve history ─────────────────────────────────────────
    const history = readHistory(undefined, 20);

    expect(history.length).toBe(1);
    expect(history[0].text).toBe(replyText);
    expect(history[0].tweetId).toBe(tweetId);
    expect(history[0].status).toBe("sent");

    // Filter by tweetId
    const filtered = readHistory(tweetId);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(entry.id);
  });
});
