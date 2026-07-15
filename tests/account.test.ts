/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";

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

// Mock os.homedir() to return a deterministic path
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
  getAccountDir,
  getAccountConfigPath,
  ACTIVE_ACCOUNT_PATH,
  CONFIG_DIR,
  CONFIG_PATH,
  getConfig,
} from "../src/config.js";
import type { Config } from "../src/config.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const HOMEDIR = "/home/testuser";
const ACCOUNTS_DIR = join(HOMEDIR, ".replyflow", "accounts");

/**
 * Simulate writing an active_account file by having existsSync/readFileSync
 * return appropriate values.
 */
function mockActiveAccount(account: string | undefined): void {
  if (account) {
    // active_account file exists and contains the account name
    vi.mocked(existsSync).mockImplementation((path: string) => {
      if (path === ACTIVE_ACCOUNT_PATH) return true;
      if (path === CONFIG_PATH) return false; // no default config
      // Check if account config exists
      if (path === getAccountConfigPath(account)) return true;
      return false;
    });
    vi.mocked(readFileSync).mockImplementation((path: string) => {
      if (path === ACTIVE_ACCOUNT_PATH) return account;
      if (path === getAccountConfigPath(account)) {
        return JSON.stringify({
          nicheKeywords: [`keyword-${account}`],
          replyStyle: "curious",
        });
      }
      return "{}";
    });
  } else {
    // No active account — active_account file doesn't exist
    vi.mocked(existsSync).mockImplementation((path: string) => {
      if (path === ACTIVE_ACCOUNT_PATH) return false;
      if (path === CONFIG_PATH) return false;
      return false;
    });
    vi.mocked(readFileSync).mockImplementation(() => "{}");
  }
}

/**
 * Simulate having a default config.json with no active account.
 */
function mockDefaultConfig(config: Partial<Config> = {}): void {
  vi.mocked(existsSync).mockImplementation((path: string) => {
    if (path === ACTIVE_ACCOUNT_PATH) return false;
    if (path === CONFIG_PATH) return true;
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

  // ── getEffectiveConfig ───────────────────────────────────────────────────

  describe("getEffectiveConfig", () => {
    it("falls back to default config when no account is active", () => {
      mockDefaultConfig({ replyStyle: "casual" });

      const result = getEffectiveConfig();

      expect(result.replyStyle).toBe("casual");
      expect(result.nicheKeywords).toContain("indie dev");
    });

    it("returns default config when no account is active and no config file exists", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getEffectiveConfig();

      expect(result.replyStyle).toBe("curious");
    });

    it("reads from account config when account is active", () => {
      mockActiveAccount("work");

      const result = getEffectiveConfig();

      expect(result.nicheKeywords).toEqual(["keyword-work"]);
      expect(result.replyStyle).toBe("curious");
    });

    it("merges account config with defaults", () => {
      // Active account exists with partial config
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return true;
        if (path === getAccountConfigPath("personal")) return true;
        return false;
      });
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return "personal";
        if (path === getAccountConfigPath("personal")) {
          return JSON.stringify({ replyStyle: "supportive" });
        }
        return "{}";
      });

      const result = getEffectiveConfig();

      expect(result.replyStyle).toBe("supportive");
      // Falls back to default keywords since not in account config
      expect(result.nicheKeywords).toContain("indie dev");
    });

    it("returns defaults when account config file is corrupt", () => {
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return true;
        if (path === getAccountConfigPath("broken")) return true;
        return false;
      });
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return "broken";
        if (path === getAccountConfigPath("broken")) {
          throw new Error("parse error");
        }
        return "{}";
      });

      const result = getEffectiveConfig();

      expect(result.replyStyle).toBe("curious");
      expect(result.nicheKeywords).toContain("indie dev");
    });

    it("returns defaults when account directory exists but no config file", () => {
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return true;
        // Account config file doesn't exist
        return false;
      });
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return "new-account";
        return "{}";
      });

      const result = getEffectiveConfig();

      expect(result.replyStyle).toBe("curious");
      expect(result.nicheKeywords).toContain("indie dev");
    });
  });

  // ── updateEffectiveConfig ────────────────────────────────────────────────

  describe("updateEffectiveConfig", () => {
    it("writes to default config when no account is active", () => {
      mockDefaultConfig({ replyStyle: "casual" });

      updateEffectiveConfig({ replyStyle: "thoughtful" });

      expect(writeFileSync).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.stringContaining("thoughtful"),
        "utf-8",
      );
    });

    it("writes to account config when account is active", () => {
      mockActiveAccount("work");

      updateEffectiveConfig({ replyStyle: "supportive" });

      const expectedPath = getAccountConfigPath("work");
      expect(writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining("supportive"),
        "utf-8",
      );
    });

    it("merges with existing account config values", () => {
      mockActiveAccount("work");

      updateEffectiveConfig({ nicheKeywords: ["new-keyword"] });

      const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      // Should keep existing nicheKeywords and merge new ones
      expect(parsed.nicheKeywords).toEqual(["new-keyword"]);
      expect(parsed.replyStyle).toBe("curious");
    });

    it("creates account directory when it does not exist", () => {
      // Active account set but account directory doesn't exist
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return true;
        return false;
      });
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return "new-account";
        return "{}";
      });

      updateEffectiveConfig({ nicheKeywords: ["dev"] });

      expect(mkdirSync).toHaveBeenCalledWith(
        getAccountDir("new-account"),
        { recursive: true },
      );
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  // ── Path helpers ─────────────────────────────────────────────────────────

  describe("path helpers", () => {
    it("getAccountDir returns correct path", () => {
      const result = getAccountDir("personal");
      expect(result).toBe(`${ACCOUNTS_DIR}/personal`);
    });

    it("getAccountConfigPath returns correct path", () => {
      const result = getAccountConfigPath("work");
      expect(result).toBe(`${ACCOUNTS_DIR}/work/config.json`);
    });

    it("ACTIVE_ACCOUNT_PATH is under CONFIG_DIR", () => {
      expect(ACTIVE_ACCOUNT_PATH).toBe(join(CONFIG_DIR, "active_account"));
    });
  });

  // ── Interaction: switch → effective config ───────────────────────────────

  describe("switch then getEffectiveConfig", () => {
    it("switch_account followed by getEffectiveConfig reads new account", () => {
      // Step 1: No active account, default config exists
      mockDefaultConfig({ replyStyle: "casual" });

      // Step 2: Switch to "work"
      vi.mocked(existsSync).mockReset();
      vi.mocked(readFileSync).mockReset();
      vi.mocked(writeFileSync).mockReset();

      // Simulate setActiveAccount writing the file
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return true;
        if (path === CONFIG_PATH) return true;
        if (path === getAccountConfigPath("work")) return true;
        return false;
      });
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return "work";
        if (path === CONFIG_PATH) return JSON.stringify({ replyStyle: "casual" });
        if (path === getAccountConfigPath("work")) {
          return JSON.stringify({ nicheKeywords: ["work-specific"] });
        }
        return "{}";
      });

      const result = getEffectiveConfig();

      // Should read from the "work" account config, not default
      expect(result.nicheKeywords).toEqual(["work-specific"]);
    });
  });

  // ── backward compat: getConfig unaffected ───────────────────────────────

  describe("backward compatibility", () => {
    it("getConfig still reads from default config.json regardless of active account", () => {
      // Default config exists
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === CONFIG_PATH) return true;
        return false; // no active_account file
      });
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === CONFIG_PATH) {
          return JSON.stringify({ replyStyle: "supportive" });
        }
        return "{}";
      });

      // Set active account
      vi.mocked(existsSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return true;
        if (path === CONFIG_PATH) return true;
        if (path === getAccountConfigPath("personal")) return true;
        return false;
      });
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (path === ACTIVE_ACCOUNT_PATH) return "personal";
        if (path === CONFIG_PATH) {
          return JSON.stringify({ replyStyle: "supportive" });
        }
        if (path === getAccountConfigPath("personal")) {
          return JSON.stringify({ nicheKeywords: ["personal-keywords"] });
        }
        return "{}";
      });

      // getConfig should still read default config.json
      const result = getConfig();

      expect(result.replyStyle).toBe("supportive");
    });
  });
});
