/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock fs ──────────────────────────────────────────────────────────────────

vi.mock("fs", () => {
  const mock = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
  return { ...mock, default: mock };
});

vi.mock("os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
  default: { homedir: vi.fn(() => "/home/testuser") },
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import {
  getActiveAccount,
  setActiveAccount,
  getEffectiveConfig,
  updateEffectiveConfig,
  ACTIVE_ACCOUNT_PATH,
  CONFIG_DIR,
  CONFIG_PATH,
  getConfig,
} from "../src/config.js";
import type { Config } from "../src/config.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const HOMEDIR = "/home/testuser";

/**
 * Simulate having a default config.json with given content.
 */
function mockDefaultConfig(config: Partial<Config> = {}): void {
  vi.mocked(existsSync).mockImplementation((path: string) => {
    if (path === CONFIG_PATH) return true;
    if (path === ACTIVE_ACCOUNT_PATH) return false;
    return false;
  });
  vi.mocked(readFileSync).mockImplementation((path: string) => {
    if (path === CONFIG_PATH) return JSON.stringify(config);
    return "{}";
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("account switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homedir).mockReturnValue(HOMEDIR);
  });

  // ── getActiveAccount ─────────────────────────────────────────────────────

  describe("getActiveAccount", () => {
    it("returns undefined when active_account file does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getActiveAccount();

      expect(result).toBeUndefined();
    });

    it("returns account name when active_account file exists", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("work");

      const result = getActiveAccount();

      expect(result).toBe("work");
    });

    it("trims whitespace from account name", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("  personal  ");

      const result = getActiveAccount();

      expect(result).toBe("personal");
    });

    it("returns undefined when file is empty", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("");

      const result = getActiveAccount();

      expect(result).toBeUndefined();
    });

    it("returns undefined when readFileSync throws", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("permission denied");
      });

      const result = getActiveAccount();

      expect(result).toBeUndefined();
    });
  });

  // ── setActiveAccount ─────────────────────────────────────────────────────

  describe("setActiveAccount", () => {
    it("creates config directory if needed and writes account name", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      setActiveAccount("myaccount");

      expect(mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
      expect(writeFileSync).toHaveBeenCalledWith(
        ACTIVE_ACCOUNT_PATH,
        "myaccount",
        "utf-8",
      );
    });

    it("overwrites existing active_account file", () => {
      vi.mocked(existsSync).mockReturnValue(true);

      setActiveAccount("newaccount");

      expect(writeFileSync).toHaveBeenCalledWith(
        ACTIVE_ACCOUNT_PATH,
        "newaccount",
        "utf-8",
      );
    });
  });

  // ── getEffectiveConfig (project-centric) ────────────────────────────────

  describe("getEffectiveConfig", () => {
    it("reads from config.json and returns project info when present", () => {
      mockDefaultConfig({
        activeProject: "myapp",
        projects: {
          myapp: {
            name: "MyApp",
            description: "A cool app",
            url: "https://myapp.com",
            keywords: ["myapp", "saas"],
          },
        },
        replyStyle: "thoughtful",
      });

      const result = getEffectiveConfig();

      expect(result.activeProject).toBe("myapp");
      expect(result.projects?.myapp?.keywords).toEqual(["myapp", "saas"]);
      expect(result.replyStyle).toBe("thoughtful");
    });

    it("returns default config when no config file exists", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getEffectiveConfig();

      expect(result.replyStyle).toBe("curious");
      expect(result.nicheKeywords).toContain("indie dev");
    });

    it("returns defaults when config file is corrupt", () => {
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === CONFIG_PATH) return true;
        return false;
      });
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("parse error");
      });

      const result = getEffectiveConfig();

      expect(result.replyStyle).toBe("curious");
      expect(result.nicheKeywords).toContain("indie dev");
    });
  });

  // ── updateEffectiveConfig (project-centric) ─────────────────────────────

  describe("updateEffectiveConfig", () => {
    it("writes to config.json and merges project info", () => {
      mockDefaultConfig({ replyStyle: "casual" });

      updateEffectiveConfig({
        activeProject: "myapp",
        projects: {
          myapp: {
            name: "MyApp",
            description: "A cool app",
            url: "https://myapp.com",
            keywords: ["saas"],
          },
        },
      });

      expect(writeFileSync).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.stringContaining("MyApp"),
        "utf-8",
      );
      expect(writeFileSync).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.stringContaining("myapp"),
        "utf-8",
      );
    });

    it("preserves existing config when updating partially", () => {
      mockDefaultConfig({
        activeProject: "myapp",
        projects: {
          myapp: {
            name: "MyApp",
            description: "A cool app",
            url: "https://myapp.com",
            keywords: ["saas"],
          },
        },
        replyStyle: "curious",
      });

      updateEffectiveConfig({ replyStyle: "supportive" });

      const writtenContent = vi.mocked(writeFileSync).mock
        .calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.replyStyle).toBe("supportive");
      expect(parsed.activeProject).toBe("myapp");
      expect(parsed.projects.myapp.name).toBe("MyApp");
    });
  });

  // ── backward compat: getConfig unaffected ───────────────────────────────

  describe("backward compatibility", () => {
    it("getConfig reads from config.json regardless of active account", () => {
      mockDefaultConfig({
        activeProject: "myapp",
        projects: {
          myapp: {
            name: "MyApp",
            description: "App desc",
            url: "https://myapp.com",
            keywords: ["myapp"],
          },
        },
        replyStyle: "supportive",
      });

      const result = getConfig();

      expect(result.replyStyle).toBe("supportive");
      expect(result.activeProject).toBe("myapp");
    });
  });
});
