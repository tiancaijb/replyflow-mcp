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
  resolveTwitterApiKey,
  resolveTwitterApiSecret,
  resolveTwitterAccessToken,
  resolveTwitterAccessTokenSecret,
  resolveAnthropicApiKey,
  resolveOpenAiApiKey,
  getNicheKeywords,
  getReplyStyle,
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

      expect(result.preferredStyle).toBe("curious");
      expect(result.nicheKeywords).toContain("indie dev");
      expect(readFileSync).not.toHaveBeenCalled();
    });

    it("returns merged config when file exists and is valid JSON", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ preferredStyle: "supportive", nicheKeywords: ["react", "typescript"] }),
      );

      const result = getConfig();

      expect(result.preferredStyle).toBe("supportive");
      expect(result.nicheKeywords).toEqual(["react", "typescript"]);
    });

    it("merges with defaults when config file has only partial fields", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ preferredStyle: "thoughtful" }));

      const result = getConfig();

      expect(result.preferredStyle).toBe("thoughtful");
      // Falls back to default keywords
      expect(result.nicheKeywords).toContain("indie dev");
    });

    it("returns defaults when config file cannot be parsed", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("not valid json {{{");

      const result = getConfig();

      expect(result.preferredStyle).toBe("curious");
      expect(result.nicheKeywords).toContain("indie dev");
    });

    it("returns defaults when readFileSync throws", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("permission denied");
      });

      const result = getConfig();

      expect(result.preferredStyle).toBe("curious");
    });
  });

  // ── updateConfig ─────────────────────────────────────────────────────────

  describe("updateConfig", () => {
    it("merges partial config and writes to disk", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ preferredStyle: "casual", nicheKeywords: ["dev"] }),
      );

      const result = updateConfig({ preferredStyle: "supportive" });

      expect(result.preferredStyle).toBe("supportive");
      expect(result.nicheKeywords).toEqual(["dev"]);
      expect(writeFileSync).toHaveBeenCalledWith(
        CONFIG_PATH,
        expect.stringContaining("supportive"),
        "utf-8",
      );
    });

    it("creates config directory if it does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      updateConfig({ twitterApiKey: "key" });

      expect(mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  // ── checkConfigIntegrity ──────────────────────────────────────────────────

  describe("checkConfigIntegrity", () => {
    afterEach(() => {
      delete process.env.TWITTER_API_KEY;
      delete process.env.TWITTER_API_SECRET;
      delete process.env.TWITTER_ACCESS_TOKEN;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
    });

    it("reports missing API creds when neither config nor env has keys", () => {
      const config: Config = {};

      const report = checkConfigIntegrity(config);

      expect(report.ok).toBe(false);
      expect(report.missing.length).toBeGreaterThan(0);
      expect(report.missing[0]).toContain("Twitter API Key");
    });

    it("passes when env vars provide API creds", () => {
      process.env.TWITTER_API_KEY = "env-key";
      process.env.TWITTER_API_SECRET = "env-secret";

      const config: Config = {};
      const report = checkConfigIntegrity(config);

      expect(report.ok).toBe(true);
    });

    it("passes when config provides API creds", () => {
      const config: Config = {
        twitterApiKey: "cfg-key",
        twitterApiSecret: "cfg-secret",
      };

      const report = checkConfigIntegrity(config);

      expect(report.ok).toBe(true);
    });

    it("warns when no user-context auth token is present", () => {
      process.env.TWITTER_API_KEY = "key";
      process.env.TWITTER_API_SECRET = "secret";

      const config: Config = {};
      const report = checkConfigIntegrity(config);

      expect(report.warnings.some((w) => w.includes("user-context auth"))).toBe(true);
    });

    it("warns when no LLM API key is present", () => {
      process.env.TWITTER_API_KEY = "key";
      process.env.TWITTER_API_SECRET = "secret";
      process.env.TWITTER_ACCESS_TOKEN = "token";

      const config: Config = {};
      const report = checkConfigIntegrity(config);

      expect(report.warnings.some((w) => w.includes("LLM API key"))).toBe(true);
    });

    it("does not warn about LLM when Anthropic key is in config", () => {
      process.env.TWITTER_API_KEY = "key";
      process.env.TWITTER_API_SECRET = "secret";

      const config: Config = { anthropicApiKey: "sk-ant-test" };
      const report = checkConfigIntegrity(config);

      expect(report.warnings.some((w) => w.includes("LLM API key"))).toBe(false);
    });
  });

  // ── resolve helpers ──────────────────────────────────────────────────────

  describe("resolveTwitterApiKey", () => {
    afterEach(() => {
      delete process.env.TWITTER_API_KEY;
    });

    it("returns env var when set", () => {
      process.env.TWITTER_API_KEY = "env-key";
      const result = resolveTwitterApiKey({ twitterApiKey: "cfg-key" });
      expect(result).toBe("env-key");
    });

    it("falls back to config value", () => {
      const result = resolveTwitterApiKey({ twitterApiKey: "cfg-key" });
      expect(result).toBe("cfg-key");
    });

    it("throws when neither is set", () => {
      expect(() => resolveTwitterApiKey({})).toThrow("Twitter API key not found");
    });
  });

  describe("resolveTwitterApiSecret", () => {
    afterEach(() => {
      delete process.env.TWITTER_API_SECRET;
    });

    it("returns env var when set", () => {
      process.env.TWITTER_API_SECRET = "env-secret";
      const result = resolveTwitterApiSecret({ twitterApiSecret: "cfg-secret" });
      expect(result).toBe("env-secret");
    });

    it("falls back to config value", () => {
      const result = resolveTwitterApiSecret({ twitterApiSecret: "cfg-secret" });
      expect(result).toBe("cfg-secret");
    });

    it("throws when neither is set", () => {
      expect(() => resolveTwitterApiSecret({})).toThrow(
        "Twitter API secret not found",
      );
    });
  });

  describe("resolveTwitterAccessToken", () => {
    afterEach(() => {
      delete process.env.TWITTER_ACCESS_TOKEN;
    });

    it("returns env var when set", () => {
      process.env.TWITTER_ACCESS_TOKEN = "env-token";
      const result = resolveTwitterAccessToken({ twitterAccessToken: "cfg-token" });
      expect(result).toBe("env-token");
    });

    it("returns config value when no env var", () => {
      const result = resolveTwitterAccessToken({ twitterAccessToken: "cfg-token" });
      expect(result).toBe("cfg-token");
    });

    it("returns undefined when neither is set", () => {
      const result = resolveTwitterAccessToken({});
      expect(result).toBeUndefined();
    });
  });

  describe("resolveTwitterAccessTokenSecret", () => {
    afterEach(() => {
      delete process.env.TWITTER_ACCESS_TOKEN_SECRET;
    });

    it("returns env var when set", () => {
      process.env.TWITTER_ACCESS_TOKEN_SECRET = "env-secret";
      const result = resolveTwitterAccessTokenSecret({
        twitterAccessTokenSecret: "cfg-secret",
      });
      expect(result).toBe("env-secret");
    });

    it("returns config value when no env var", () => {
      const result = resolveTwitterAccessTokenSecret({
        twitterAccessTokenSecret: "cfg-secret",
      });
      expect(result).toBe("cfg-secret");
    });

    it("returns undefined when neither is set", () => {
      const result = resolveTwitterAccessTokenSecret({});
      expect(result).toBeUndefined();
    });
  });

  describe("resolveAnthropicApiKey", () => {
    afterEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
    });

    it("returns env var when set", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-env";
      const result = resolveAnthropicApiKey({ anthropicApiKey: "sk-ant-cfg" });
      expect(result).toBe("sk-ant-env");
    });

    it("returns config value when no env var", () => {
      const result = resolveAnthropicApiKey({ anthropicApiKey: "sk-ant-cfg" });
      expect(result).toBe("sk-ant-cfg");
    });

    it("returns undefined when neither is set", () => {
      const result = resolveAnthropicApiKey({});
      expect(result).toBeUndefined();
    });
  });

  describe("resolveOpenAiApiKey", () => {
    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it("returns env var when set", () => {
      process.env.OPENAI_API_KEY = "sk-openai-env";
      const result = resolveOpenAiApiKey({ openaiApiKey: "sk-openai-cfg" });
      expect(result).toBe("sk-openai-env");
    });

    it("returns config value when no env var", () => {
      const result = resolveOpenAiApiKey({ openaiApiKey: "sk-openai-cfg" });
      expect(result).toBe("sk-openai-cfg");
    });

    it("returns undefined when neither is set", () => {
      const result = resolveOpenAiApiKey({});
      expect(result).toBeUndefined();
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

  // ── getReplyStyle ────────────────────────────────────────────────────────

  describe("getReplyStyle", () => {
    it("returns replyStyle when set", () => {
      const result = getReplyStyle({ replyStyle: "supportive" });
      expect(result).toBe("supportive");
    });

    it("falls back to preferredStyle when replyStyle is not set", () => {
      const result = getReplyStyle({ preferredStyle: "thoughtful" });
      expect(result).toBe("thoughtful");
    });

    it("returns default 'curious' when nothing is set", () => {
      const result = getReplyStyle({});
      expect(result).toBe("curious");
    });

    it("prefers replyStyle over preferredStyle", () => {
      const result = getReplyStyle({
        replyStyle: "casual",
        preferredStyle: "supportive",
      });
      expect(result).toBe("casual");
    });
  });
});
