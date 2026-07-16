/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import logger, { Logger } from "../src/logger.js";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Logger singleton", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it("exports a default logger instance", () => {
    expect(logger).toBeInstanceOf(Logger);
  });

  it("writes formatted error message to stderr", () => {
    logger.error("Something went wrong");

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ReplyFlow]"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[ERROR]"));
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Something went wrong"),
    );
    // Ends with newline
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringMatching(/.+\n$/));
  });

  it("writes formatted info message to stderr", () => {
    logger.info("Server started");

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[INFO]"));
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Server started"),
    );
  });

  it("writes formatted warn message to stderr", () => {
    logger.warn("Deprecated config");

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[WARN]"));
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Deprecated config"),
    );
  });

  it("writes formatted debug message to stderr", () => {
    const debugLogger = new Logger("debug");
    debugLogger.debug("Fetching tweets");

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[DEBUG]"));
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Fetching tweets"),
    );
  });
});

describe("Log level filtering", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("filters out debug messages when level is info (default)", () => {
    const testLogger = new Logger("info");
    testLogger.debug("should not appear");
    testLogger.info("should appear");

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("should not appear"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("should appear"),
    );
  });

  it("filters out info messages when level is warn", () => {
    const testLogger = new Logger("warn");
    testLogger.info("should not appear");
    testLogger.warn("should appear");

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("should not appear"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("should appear"),
    );
  });

  it("filters out warn messages when level is error", () => {
    const testLogger = new Logger("error");
    testLogger.warn("should not appear");
    testLogger.error("should appear");

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("should not appear"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("should appear"),
    );
  });

  it("allows all levels when level is debug", () => {
    const testLogger = new Logger("debug");
    testLogger.debug("debug msg");
    testLogger.info("info msg");
    testLogger.warn("warn msg");
    testLogger.error("error msg");

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("debug msg"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("info msg"));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("warn msg"));
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("error msg"),
    );
  });

  it("respects LOG_LEVEL env var", () => {
    vi.stubEnv("LOG_LEVEL", "error");
    const testLogger = new Logger();
    testLogger.info("should not appear");
    testLogger.error("should appear");

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("should not appear"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("should appear"),
    );

    vi.unstubAllEnvs();
  });

  it("defaults to info when LOG_LEVEL is invalid", () => {
    vi.stubEnv("LOG_LEVEL", "invalid");
    const testLogger = new Logger();
    testLogger.debug("should not appear");
    testLogger.info("should appear");

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("should not appear"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("should appear"),
    );

    vi.unstubAllEnvs();
  });
});

describe("Logger child context", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it("creates a child logger with context prefix", () => {
    const child = logger.child("config");
    child.info("reading config");

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[config]"));
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("reading config"),
    );
  });

  it("supports nested child contexts", () => {
    const child = logger.child("config").child("file");
    child.warn("parse error");

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("[config:file]"),
    );
  });

  it("child logger inherits parent log level", () => {
    const parent = new Logger("error");
    const child = parent.child("db");
    child.info("should not appear");
    child.error("should appear");

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("should not appear"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("should appear"),
    );
  });
});

describe("Logger setLevel", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it("changes log level at runtime", () => {
    const testLogger = new Logger("info");
    testLogger.debug("should not appear");
    testLogger.setLevel("debug");
    testLogger.debug("should appear now");

    expect(stderrSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("should not appear"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("should appear now"),
    );
  });

  it("getLevel returns current level", () => {
    const testLogger = new Logger("warn");
    expect(testLogger.getLevel()).toBe("warn");
    testLogger.setLevel("debug");
    expect(testLogger.getLevel()).toBe("debug");
  });
});
