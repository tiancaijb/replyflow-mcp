/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockQuestion, mockClose } = vi.hoisted(() => ({
  mockQuestion: vi.fn(),
  mockClose: vi.fn(),
}));

const { mockUpdateConfig } = vi.hoisted(() => ({
  mockUpdateConfig: vi.fn(),
}));

vi.mock("node:readline/promises", () => {
  const createInterface = vi.fn(() => ({
    question: mockQuestion,
    close: mockClose,
  }));
  return {
    createInterface,
    default: { createInterface },
  };
});

vi.mock("node:process", () => ({
  stdin: { isTTY: true },
  stdout: { isTTY: true },
}));

vi.mock("../src/config.js", () => ({
  updateEffectiveConfig: mockUpdateConfig,
  CONFIG_PATH: "/home/testuser/.replyflow/config.json",
}));

// ── Silence console output during tests ──────────────────────────────────────

vi.spyOn(console, "log").mockImplementation(() => {});

// ── Import after mocks ───────────────────────────────────────────────────────

import {
  runInteractiveSetup,
} from "../src/setup.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Set up mock question responses in order.
 * Each call to rl.question() returns the next value from the array.
 */
function mockAnswers(answers: string[]): void {
  mockQuestion.mockReset();
  for (const answer of answers) {
    mockQuestion.mockResolvedValueOnce(answer);
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("runInteractiveSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClose.mockReset();
    mockUpdateConfig.mockReset();
  });

  it("completes full flow with all inputs and saves config", async () => {
    // 7 answers: name, desc, URL, keywords, style (1=curious), language, confirm
    mockAnswers([
      "MyApp",
      "A test application",
      "https://myapp.dev",
      "test, app, demo",
      "1",
      "中文",
      "y",
    ]);

    const result = await runInteractiveSetup();

    expect(result).toBe(true);
    expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        activeProject: "MyApp",
        replyStyle: "curious",
        language: "中文",
      }),
    );
    expect(mockClose).toHaveBeenCalled();
  });

  it("cancels when project name is empty", async () => {
    mockAnswers([""]);

    const result = await runInteractiveSetup();

    expect(result).toBe(false);
    expect(mockUpdateConfig).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it("cancels when user types 'n' at confirmation", async () => {
    // Provide all 6 inputs, but say 'n' at confirmation
    mockAnswers([
      "MyApp",
      "A test app",
      "https://myapp.dev",
      "test, app",
      "1",
      "",
      "n",
    ]);

    const result = await runInteractiveSetup();

    expect(result).toBe(false);
    expect(mockUpdateConfig).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it("uses default values when user enters empty strings", async () => {
    // Empty keywords → use default; empty style → default (curious); empty lang → undefined
    mockAnswers([
      "TestPro",
      "Test project",
      "https://test.pro",
      "",
      "",
      "",
      "y",
    ]);

    const result = await runInteractiveSetup();

    expect(result).toBe(true);
    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        activeProject: "TestPro",
        projects: expect.objectContaining({
          TestPro: expect.objectContaining({
            keywords: ["indie dev", "saas", "build in public", "coding", "solopreneur"],
          }),
        }),
        replyStyle: "curious",
        language: undefined,
      }),
    );
  });

  it("supports all 5 reply style choices", async () => {
    const styleChoices = [
      { input: "1", expected: "curious" },
      { input: "2", expected: "casual" },
      { input: "3", expected: "supportive" },
      { input: "4", expected: "thoughtful" },
      { input: "5", expected: "auto" },
    ];

    for (const { input, expected } of styleChoices) {
      mockAnswers([
        "StyleApp",
        "Test",
        "https://test.dev",
        "test",
        input,
        "",
        "y",
      ]);

      const result = await runInteractiveSetup();

      expect(result).toBe(true);
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ replyStyle: expected }),
      );

      vi.clearAllMocks();
      mockClose.mockReset();
      mockUpdateConfig.mockReset();
    }
  });

  it("handles invalid style choice by defaulting to the last valid option", async () => {
    // "999" → parseInt("999") - 1 = 998 → Math.min(998, 4) = 4 → STYLES[4] = "auto"
    mockAnswers([
      "MyApp",
      "Test",
      "https://test.dev",
      "test",
      "999",
      "",
      "y",
    ]);

    const result = await runInteractiveSetup();

    expect(result).toBe(true);
    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ replyStyle: "auto" }),
    );
  });

  it("handles language as English", async () => {
    mockAnswers([
      "EngApp",
      "English test",
      "https://eng.dev",
      "test",
      "1",
      "English",
      "y",
    ]);

    const result = await runInteractiveSetup();

    expect(result).toBe(true);
    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ language: "English" }),
    );
  });

  it("handles language as empty string (auto-detect)", async () => {
    mockAnswers([
      "AutoLang",
      "Auto test",
      "https://auto.dev",
      "test",
      "1",
      "",
      "y",
    ]);

    const result = await runInteractiveSetup();

    expect(result).toBe(true);
    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ language: undefined }),
    );
  });

  it("always closes readline in finally block", async () => {
    // Force an error after setup
    mockQuestion.mockRejectedValueOnce(new Error("Unexpected error"));

    await expect(runInteractiveSetup()).rejects.toThrow();
    expect(mockClose).toHaveBeenCalled();
  });

  it("handles keywords with extra whitespace", async () => {
    mockAnswers([
      "WhitespaceApp",
      "Test",
      "https://ws.dev",
      "  keyword1 ,  keyword2 ,  keyword3  ",
      "1",
      "",
      "y",
    ]);

    const result = await runInteractiveSetup();

    expect(result).toBe(true);
    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        projects: expect.objectContaining({
          WhitespaceApp: expect.objectContaining({
            keywords: ["keyword1", "keyword2", "keyword3"],
          }),
        }),
      }),
    );
  });
});
