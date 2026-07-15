/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mock fs ──────────────────────────────────────────────────────────────────
// Hoisted before imports so the config module sees mocked fs

vi.mock("fs", () => {
  const mock = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
  return { ...mock, default: mock };
});

// ── Import after mock ───────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import {
  getConfig,
  updateConfig,
  checkConfigIntegrity,
  getNicheKeywords,
  CONFIG_PATH,
  CONFIG_DIR,
} from "../src/config.js";
import type { Config } from "../src/config.js";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getConfig ────────────────────────────────────────────────────────────

  describe("getConfig", () => {
    it("returns default config when file does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getConfig();

      expect(result.replyStyle).toBe("curious");
      expect(result.nicheKeywords).toContain("indie dev");
      expect(readFileSync).not.toHaveBeenCalled();
    });

    it("returns merged config when file exists and is valid JSON", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ replyStyle: "supportive", nicheKeywords: ["react", "typescript"] }),
      );

      const result = getConfig();

      expect(result.replyStyle).toBe("supportive");
      expect(result.nicheKeywords).toEqual(["react", "typescript"]);
    });

    it("merges with defaults when config file has only partial fields", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ replyStyle: "thoughtful" }));

      const result = getConfig();

      expect(result.replyStyle).toBe("thoughtful");
      // Falls back to default keywords
      expect(result.nicheKeywords).toContain("indie dev");
    });

    it("returns defaults when config file cannot be parsed", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("not valid json {{{");

      const result = getConfig();

      expect(result.replyStyle).toBe("curious");
      expect(result.nicheKeywords).toContain("indie dev");
    });

    it("returns defaults when readFileSync throws", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("permission denied");
      });

      const result = getConfig();

      expect(result.replyStyle).toBe("curious");
    });
  });

  // ── updateConfig ─────────────────────────────────────────────────────────

  describe("updateConfig", () => {
    it("merges partial config and writes to disk", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ replyStyle: "casual", nicheKeywords: ["dev"] }),
      );

      const result = updateConfig({ replyStyle: "supportive" });

      expect(result.replyStyle).toBe("supportive");
      expect(result.nicheKeywords).toEqual(["dev"]);
      expect(writeFileSync).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.stringContaining("supportive"),
        "utf-8",
      );
    });

    it("creates config directory if it does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      updateConfig({ nicheKeywords: ["key"] });

      expect(mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  // ── checkConfigIntegrity ──────────────────────────────────────────────────

  describe("checkConfigIntegrity", () => {
    it("always returns ok (twitter-cli handles auth via cookies)", () => {
      const config: Config = {};

      const report = checkConfigIntegrity(config);

      expect(report.ok).toBe(true);
      expect(report.missing).toEqual([]);
      expect(report.warnings).toEqual([]);
    });

    it("returns ok regardless of config contents", () => {
      const config: Config = {
        replyStyle: "supportive",
        nicheKeywords: ["react"],
      };

      const report = checkConfigIntegrity(config);

      expect(report.ok).toBe(true);
    });
  });

  // ── getNicheKeywords ─────────────────────────────────────────────────────

  describe("getNicheKeywords", () => {
    it("returns keywords from config when present", () => {
      const result = getNicheKeywords({ nicheKeywords: ["react", "node"] });
      expect(result).toEqual(["react", "node"]);
    });

    it("returns defaults when config has empty array", () => {
      const result = getNicheKeywords({ nicheKeywords: [] });
      expect(result).toContain("indie dev");
    });

    it("returns defaults when config has no keywords", () => {
      const result = getNicheKeywords({});
      expect(result).toContain("indie dev");
    });
  });
});
