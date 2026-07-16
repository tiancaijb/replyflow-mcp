/// <reference types="vitest/globals" />

/**
 * Integration test: multi-project configuration and switching.
 *
 * Tests creating multiple projects, switching between them,
 * and verifying project-specific keyword search.
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
  TEST_HOME: "/tmp/test-replyflow-multi-project",
}));

vi.mock("os", () => ({
  homedir: vi.fn(() => TEST_HOME),
  default: { homedir: vi.fn(() => TEST_HOME) },
}));

beforeEach(() => {
  if (!existsSync(join(TEST_HOME, ".replyflow"))) {
    mkdirSync(join(TEST_HOME, ".replyflow"), { recursive: true });
  }
});

afterEach(() => {
  // Clean up
  try {
    const dir = join(TEST_HOME, ".replyflow");
    if (existsSync(join(dir, "config.json"))) unlinkSync(join(dir, "config.json"));
    if (existsSync(join(dir, "history.json"))) unlinkSync(join(dir, "history.json"));
    if (existsSync(join(dir, "active_account"))) unlinkSync(join(dir, "active_account"));
  } catch {
    // ignore
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("multi-project support", () => {
  it("creates multiple projects and switches between them", async () => {
    const { updateEffectiveConfig, getEffectiveConfig, getNicheKeywords } =
      await import("../../src/config.js");

    // ── 1. Create project A (indie dev) ──────────────────────────────
    updateEffectiveConfig({
      activeProject: "IndieProject",
      projects: {
        IndieProject: {
          name: "Indie Project",
          description: "An indie dev tool",
          url: "https://indie.example.com",
          keywords: ["indie", "side project", "bootstrapped"],
        },
      },
    });

    let cfg = getEffectiveConfig();
    expect(cfg.activeProject).toBe("IndieProject");
    expect(getNicheKeywords(cfg)).toEqual(["indie", "side project", "bootstrapped"]);

    // ── 2. Add project B (AI project) ───────────────────────────────
    updateEffectiveConfig({
      projects: {
        ...cfg.projects,
        AIProject: {
          name: "AI Project",
          description: "An AI-powered tool",
          url: "https://ai.example.com",
          keywords: ["machine learning", "AI", "llm"],
        },
      },
    });

    cfg = getEffectiveConfig();
    // Active project is still IndieProject
    expect(cfg.activeProject).toBe("IndieProject");
    expect(Object.keys(cfg.projects ?? {})).toHaveLength(2);

    // ── 3. Switch to project B ─────────────────────────────────────
    updateEffectiveConfig({ activeProject: "AIProject" });

    cfg = getEffectiveConfig();
    expect(cfg.activeProject).toBe("AIProject");
    expect(getNicheKeywords(cfg)).toEqual(["machine learning", "AI", "llm"]);

    // ── 4. Switch back to project A ─────────────────────────────────
    updateEffectiveConfig({ activeProject: "IndieProject" });

    cfg = getEffectiveConfig();
    expect(cfg.activeProject).toBe("IndieProject");
    expect(getNicheKeywords(cfg)).toEqual(["indie", "side project", "bootstrapped"]);
  });

  it("searches with project-specific keywords when project name is passed to list", async () => {
    const { updateEffectiveConfig, getEffectiveConfig } =
      await import("../../src/config.js");

    // Set up two projects
    updateEffectiveConfig({
      activeProject: "DefaultProject",
      projects: {
        DefaultProject: {
          name: "Default",
          description: "Default project",
          url: "https://default.example.com",
          keywords: ["default keyword"],
        },
        SpecificProject: {
          name: "Specific",
          description: "Specific project",
          url: "https://specific.example.com",
          keywords: ["specific keyword"],
        },
      },
    });

    const cfg = getEffectiveConfig();

    // Search with specific project override
    const { list } = await import("../../src/twitter.js");
    const result = await list(cfg, "SpecificProject");

    expect(result.error).toBeUndefined();
    expect(result.tweets.length).toBeGreaterThan(0);
    // Should return tweets (from fixture)
    expect(result.tweets.every((t: { source: string }) => t.source === "search")).toBe(true);
  });
});
