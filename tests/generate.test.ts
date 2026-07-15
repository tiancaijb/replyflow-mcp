/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Module-level mocks (hoisted) ─────────────────────────────────────────────

// Mock getTweetContext from twitter module
vi.mock("../src/twitter.js", () => ({
  getTweetContext: vi.fn(),
}));

// Shared mutable capture object for the https mock.
// Using a reference type so the mock closure always sees latest values.
const httpsCapture = { body: "", url: "" };

// Mock node:https so we can intercept LLM API calls without real network
vi.mock("node:https", () => {
  // Default fake LLM response — tests can override via mockImplementation
  const defaultResponseBody = JSON.stringify({
    drafts: [
      {
        text: "oh nice, been exploring this too! what surprised you most?",
        reason: "asks for their takeaway",
      },
      {
        text: "the tradeoff I keep hitting is speed vs flexibility. how'd you navigate that?",
        reason: "specific tradeoff question",
      },
      {
        text: "love the breakdown. the bit about onboarding really resonated.",
        reason: "points to a specific detail",
      },
    ],
  });

  // This will be replaced by mockImplementation in beforeEach
  const mockRequest = vi.fn();

  // Helper to create a mock response stream
  function makeResponse(body: string, statusCode = 200) {
    const mockRes = {
      on: vi.fn(
        (event: string, handler: (...args: any[]) => void) => {
          if (event === "data") handler(Buffer.from(body));
          if (event === "end") handler();
          return mockRes;
        },
      ),
      statusCode,
    };
    return mockRes;
  }

  // Default implementation — can be overridden per test
  mockRequest.mockImplementation(
    (url: string, _opts: any, callback: (res: any) => void) => {
      httpsCapture.url = url;
      callback(makeResponse(JSON.stringify({
        content: [{ text: defaultResponseBody }],
      })));
      return {
        on: vi.fn(),
        write: vi.fn((body: string) => { httpsCapture.body = body; }),
        end: vi.fn(),
      };
    },
  );

  return {
    request: mockRequest,
    default: { request: mockRequest },
  };
});

// ── Imports (after mocks) ────────────────────────────────────────────────────

import https from "node:https";
import { generateReply } from "../src/generate.js";
import type { Draft } from "../src/generate.js";
import { getTweetContext } from "../src/twitter.js";
import type { Config } from "../src/config.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_CONFIG: Config = {
  twitterApiKey: "test-key",
  twitterApiSecret: "test-secret",
  anthropicApiKey: "sk-ant-test",
};

const DEFAULT_TWEET_TEXT = "What stack do you recommend for a new SaaS product?";

async function setupDefaultContext(text = DEFAULT_TWEET_TEXT) {
  vi.mocked(getTweetContext).mockResolvedValue({
    root: {
      id: "123",
      text,
      source: "search" as const,
      author: { id: "u1", name: "Test", username: "testuser" },
    },
    replies: [],
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("generate", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset capture
    httpsCapture.body = "";
    httpsCapture.url = "";

    // Default mocks
    await setupDefaultContext();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    delete process.env.OPENAI_API_KEY;

    // Reset https mock to default implementation
    vi.mocked(https.request).mockReset();
    vi.mocked(https.request).mockImplementation(
      (url: string, _opts: any, callback: (res: any) => void) => {
        const fakeRes = {
          on: vi.fn(
            (event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(
                  Buffer.from(
                    JSON.stringify({ content: [{ text: JSON.stringify({ drafts: [] }) }] }),
                  ),
                );
              if (event === "end") handler();
              return fakeRes;
            },
          ),
          statusCode: 200,
        } as any;
        callback(fakeRes);
        return {
          on: vi.fn(),
          write: vi.fn((body: string) => { httpsCapture.body = body; }),
          end: vi.fn(),
        } as any;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Basic success path ──────────────────────────────────────────────────

  it("generates drafts successfully with curious style", async () => {
    // Override https mock to return valid drafts
    vi.mocked(https.request).mockImplementation(
      (url: string, _opts: any, callback: (res: any) => void) => {
        const response = { drafts: [{ text: "Great reply!", reason: "engaging" }] };
        const fakeRes = {
          on: vi.fn((event: string, handler: (...args: any[]) => void) => {
            if (event === "data")
              handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
            if (event === "end") handler();
            return fakeRes;
          }),
          statusCode: 200,
        } as any;
        callback(fakeRes);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
      },
    );

    const result = await generateReply(BASE_CONFIG, "123", "curious");

    expect(result.tweetId).toBe("123");
    expect(result.style).toBe("curious");
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].text).toBe("Great reply!");
    expect(result.error).toBeUndefined();
  });

  it("returns error when getTweetContext fails", async () => {
    vi.mocked(getTweetContext).mockRejectedValue(new Error("Twitter API error"));

    const result = await generateReply(BASE_CONFIG, "123", "curious");

    expect(result.tweetId).toBe("123");
    expect(result.error).toContain("Twitter API error");
    expect(result.drafts).toHaveLength(0);
  });

  it("returns error when no LLM key is configured", async () => {
    vi.unstubAllEnvs();
    process.env.OPENAI_API_KEY = ""; // ensure no key
    delete process.env.ANTHROPIC_API_KEY;

    const result = await generateReply(
      { twitterApiKey: "key", twitterApiSecret: "secret" },
      "123",
      "curious",
    );

    expect(result.error).toContain("No LLM API key");
    expect(result.drafts).toHaveLength(0);
  });

  // ── detectStyle (auto mode) ─────────────────────────────────────────────

  describe("detectStyle (via auto mode)", () => {
    it("detects curious style for question tweets", async () => {
      await setupDefaultContext("How do you handle auth in your SaaS?");
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = { drafts: [{ text: "test", reason: "test" }] };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn((body: string) => { httpsCapture.body = body; }), end: vi.fn() } as any;
        },
      );

      const result = await generateReply(BASE_CONFIG, "123", "auto");

      expect(result.style).toBe("curious");
      // System prompt should contain curious-style instruction
      expect(httpsCapture.body).toContain("Ask thoughtful questions");
    });

    it("detects supportive style for struggle tweets", async () => {
      await setupDefaultContext("Struggling to get my first 100 users. Feeling tough.");
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = { drafts: [{ text: "test", reason: "test" }] };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn((body: string) => { httpsCapture.body = body; }), end: vi.fn() } as any;
        },
      );

      const result = await generateReply(BASE_CONFIG, "123", "auto");

      expect(result.style).toBe("supportive");
      expect(httpsCapture.body).toContain("Acknowledge their effort");
    });

    it("detects thoughtful style for long/insightful tweets", async () => {
      await setupDefaultContext(
        "Here's how I built a SaaS to $10k MRR in 6 months. " +
          "A thread with lessons learned about pricing, " +
          "distribution, and why I wish I had started earlier.",
      );
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = { drafts: [{ text: "test", reason: "test" }] };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn((body: string) => { httpsCapture.body = body; }), end: vi.fn() } as any;
        },
      );

      const result = await generateReply(BASE_CONFIG, "123", "auto");

      expect(result.style).toBe("thoughtful");
      expect(httpsCapture.body).toContain("Add a substantive observation");
    });

    it("defaults to casual for neutral short posts", async () => {
      await setupDefaultContext("Just shipped a new feature.");
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = { drafts: [{ text: "test", reason: "test" }] };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn((body: string) => { httpsCapture.body = body; }), end: vi.fn() } as any;
        },
      );

      const result = await generateReply(BASE_CONFIG, "123", "auto");

      expect(result.style).toBe("casual");
      expect(httpsCapture.body).toContain("relaxed, conversational tone");
    });
  });

  // ── parseDrafts & extractJson ───────────────────────────────────────────

  describe("parseDrafts and extractJson", () => {
    it("parses drafts from markdown-fenced JSON", async () => {
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const llmOutput =
            "Here are some drafts:\n\n```json\n{\n" +
            '  "drafts": [\n' +
            '    { "text": "Reply one", "reason": "first" },\n' +
            '    { "text": "Reply two", "reason": "second" }\n' +
            "  ]\n}\n```";
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(Buffer.from(JSON.stringify({ content: [{ text: llmOutput }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
        },
      );

      const result = await generateReply(BASE_CONFIG, "123", "casual");

      expect(result.drafts).toHaveLength(2);
      expect(result.drafts[0].text).toBe("Reply one");
      expect(result.drafts[1].text).toBe("Reply two");
    });

    it("filters out drafts exceeding 280 characters", async () => {
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = {
            drafts: [
              { text: "Short reply", reason: "ok" },
              { text: "x".repeat(281), reason: "too long" },
              { text: "Another short reply", reason: "ok" },
            ],
          };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
        },
      );

      const result = await generateReply(BASE_CONFIG, "123", "casual");

      expect(result.drafts).toHaveLength(2);
      expect(result.drafts.every((d) => d.text.length <= 280)).toBe(true);
    });

    it("handles drafts as plain strings", async () => {
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = { drafts: ["Just a string reply", "Another string draft"] };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
        },
      );

      const result = await generateReply(BASE_CONFIG, "123", "casual");

      expect(result.drafts).toHaveLength(2);
      expect(result.drafts[0].text).toBe("Just a string reply");
    });

    it("returns error when LLM returns no valid drafts after filtering", async () => {
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = {
            drafts: [
              { text: "x".repeat(281), reason: "all too long" },
              { text: "y".repeat(281), reason: "also too long" },
            ],
          };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
        },
      );

      const result = await generateReply(BASE_CONFIG, "123", "casual");

      expect(result.error).toContain("No valid drafts");
    });

    it("extracts JSON without markdown fences", async () => {
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const llmOutput = JSON.stringify({
            drafts: [{ text: "Bare JSON reply", reason: "no fences" }],
          });
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data")
                handler(Buffer.from(JSON.stringify({ content: [{ text: llmOutput }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
        },
      );

      const result = await generateReply(BASE_CONFIG, "123", "casual");

      expect(result.drafts).toHaveLength(1);
      expect(result.drafts[0].text).toBe("Bare JSON reply");
    });
  });

  // ── buildSystemPrompt ───────────────────────────────────────────────────

  describe("buildSystemPrompt (via request body inspection)", () => {
    it("includes style-specific instructions in the system prompt", async () => {
      // Capture the HTTPS request body
      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = { drafts: [{ text: "test", reason: "test" }] };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data") handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn((body: string) => { httpsCapture.body = body; }), end: vi.fn() } as any;
        },
      );

      await generateReply(BASE_CONFIG, "123", "supportive");

      // The request body is a JSON string. Parse it to inspect the system field
      const requestBody = JSON.parse(httpsCapture.body);
      expect(requestBody.system).toContain("Acknowledge their effort");
    });

    it("includes conversation context when replies exist", async () => {
      vi.mocked(getTweetContext).mockResolvedValue({
        root: {
          id: "123",
          text: "Original post",
          source: "search" as const,
          author: { id: "u1", name: "Test", username: "testuser" },
        },
        replies: [
          { id: "r1", text: "First reply", source: "mentions" as const },
          { id: "r2", text: "Second reply", source: "mentions" as const },
        ],
      });

      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = { drafts: [{ text: "test", reason: "test" }] };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data") handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn((body: string) => { httpsCapture.body = body; }), end: vi.fn() } as any;
        },
      );

      await generateReply(BASE_CONFIG, "123", "curious");

      const requestBody = JSON.parse(httpsCapture.body);
      expect(requestBody.system).toContain("Conversation Context");
      expect(requestBody.system).toContain("First reply");
      expect(requestBody.system).toContain("Second reply");
    });

    it("includes conversation context when no replies yet", async () => {
      vi.mocked(getTweetContext).mockResolvedValue({
        root: {
          id: "123",
          text: "Original post",
          source: "search" as const,
          author: { id: "u1", name: "Test", username: "testuser" },
        },
        replies: [],
      });

      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          const response = { drafts: [{ text: "test", reason: "test" }] };
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data") handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn((body: string) => { httpsCapture.body = body; }), end: vi.fn() } as any;
        },
      );

      await generateReply(BASE_CONFIG, "123", "curious");

      const requestBody = JSON.parse(httpsCapture.body);
      expect(requestBody.system).toContain("you're the first to respond");
    });
  });

  // ── detectProvider ──────────────────────────────────────────────────────

  describe("detectProvider", () => {
    it("uses Anthropic when ANTHROPIC_API_KEY is set", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-real");
      delete process.env.OPENAI_API_KEY;

      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          httpsCapture.url = url;
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data") handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify({ drafts: [{ text: "ok", reason: "ok" }] }) }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
        },
      );

      await generateReply(BASE_CONFIG, "123", "casual");

      expect(httpsCapture.url).toContain("api.anthropic.com");
    });

    it("falls back to OpenAI when only OPENAI_API_KEY is set", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-real");

      vi.mocked(https.request).mockImplementation(
        (url: string, _opts: any, callback: (res: any) => void) => {
          httpsCapture.url = url;
          const fakeRes = {
            on: vi.fn((event: string, handler: (...args: any[]) => void) => {
              if (event === "data") handler(Buffer.from(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ drafts: [{ text: "ok", reason: "ok" }] }) } }] })));
              if (event === "end") handler();
              return fakeRes;
            }),
            statusCode: 200,
          } as any;
          callback(fakeRes);
          return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
        },
      );

      await generateReply(
        { ...BASE_CONFIG, anthropicApiKey: undefined, openaiApiKey: "sk-openai-cfg" },
        "123",
        "casual",
      );

      expect(httpsCapture.url).toContain("api.openai.com");
    });
  });

  // ── draft ID assignment ─────────────────────────────────────────────────

  it("assigns sequential IDs to drafts", async () => {
    vi.mocked(https.request).mockImplementation(
      (url: string, _opts: any, callback: (res: any) => void) => {
        const response = {
          drafts: [
            { text: "First draft", reason: "first" },
            { text: "Second draft", reason: "second" },
            { text: "Third draft", reason: "third" },
          ],
        };
        const fakeRes = {
          on: vi.fn((event: string, handler: (...args: any[]) => void) => {
            if (event === "data") handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
            if (event === "end") handler();
            return fakeRes;
          }),
          statusCode: 200,
        } as any;
        callback(fakeRes);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
      },
    );

    const result = await generateReply(BASE_CONFIG, "tweet-1", "curious");

    expect(result.drafts).toHaveLength(3);
    expect(result.drafts[0].id).toBe("tweet-1_1");
    expect(result.drafts[1].id).toBe("tweet-1_2");
    expect(result.drafts[2].id).toBe("tweet-1_3");
  });

  it("caps drafts at 3 even if more are returned", async () => {
    vi.mocked(https.request).mockImplementation(
      (url: string, _opts: any, callback: (res: any) => void) => {
        const response = {
          drafts: [
            { text: "Draft 1", reason: "a" },
            { text: "Draft 2", reason: "b" },
            { text: "Draft 3", reason: "c" },
            { text: "Draft 4", reason: "d" },
            { text: "Draft 5", reason: "e" },
          ],
        };
        const fakeRes = {
          on: vi.fn((event: string, handler: (...args: any[]) => void) => {
            if (event === "data") handler(Buffer.from(JSON.stringify({ content: [{ text: JSON.stringify(response) }] })));
            if (event === "end") handler();
            return fakeRes;
          }),
          statusCode: 200,
        } as any;
        callback(fakeRes);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() } as any;
      },
    );

    const result = await generateReply(BASE_CONFIG, "123", "curious");

    expect(result.drafts).toHaveLength(3);
  });
});
