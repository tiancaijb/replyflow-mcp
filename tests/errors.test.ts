/// <reference types="vitest/globals" />

import { describe, it, expect } from "vitest";
import {
  CliError,
  CliTimeoutError,
  CliAuthError,
  CliRateLimitError,
  CliNetworkError,
  CliParseError,
  classifyCliError,
  getUserFriendlyMessage,
} from "../src/errors.js";

// ── Error class tests ─────────────────────────────────────────────────────────

describe("CliError", () => {
  it("is an instance of Error", () => {
    const e = new CliError("test");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("CliError");
    expect(e.message).toBe("test");
  });
});

describe("CliTimeoutError", () => {
  it("has timeout property", () => {
    const e = new CliTimeoutError("timed out", 30000);
    expect(e).toBeInstanceOf(CliError);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("CliTimeoutError");
    expect(e.timeout).toBe(30000);
    expect(e.message).toBe("timed out");
  });
});

describe("CliAuthError", () => {
  it("has correct name", () => {
    const e = new CliAuthError("auth failed");
    expect(e).toBeInstanceOf(CliError);
    expect(e.name).toBe("CliAuthError");
    expect(e.message).toBe("auth failed");
  });
});

describe("CliRateLimitError", () => {
  it("has correct name", () => {
    const e = new CliRateLimitError("rate limited");
    expect(e).toBeInstanceOf(CliError);
    expect(e.name).toBe("CliRateLimitError");
  });
});

describe("CliNetworkError", () => {
  it("has code property", () => {
    const e = new CliNetworkError("connection reset", "ECONNRESET");
    expect(e).toBeInstanceOf(CliError);
    expect(e.name).toBe("CliNetworkError");
    expect(e.code).toBe("ECONNRESET");
  });

  it("works without code", () => {
    const e = new CliNetworkError("network error");
    expect(e.code).toBeUndefined();
  });
});

describe("CliParseError", () => {
  it("has correct name", () => {
    const e = new CliParseError("bad json");
    expect(e).toBeInstanceOf(CliError);
    expect(e.name).toBe("CliParseError");
  });
});

// ── classifyCliError tests ──────────────────────────────────────────────────

describe("classifyCliError", () => {
  // ── Spawn errors ────────────────────────────────────────────────────

  it("classifies ECONNRESET as CliNetworkError", () => {
    const err = new Error("connect ECONNRESET 127.0.0.1:443");
    (err as NodeJS.ErrnoException).code = "ECONNRESET";

    const result = classifyCliError(err, "", null, null);

    expect(result).toBeInstanceOf(CliNetworkError);
    expect((result as CliNetworkError).code).toBe("ECONNRESET");
  });

  it("classifies ENOTFOUND as CliNetworkError", () => {
    const err = new Error("getaddrinfo ENOTFOUND api.twitter.com");
    (err as NodeJS.ErrnoException).code = "ENOTFOUND";

    const result = classifyCliError(err, "", null, null);

    expect(result).toBeInstanceOf(CliNetworkError);
    expect((result as CliNetworkError).code).toBe("ENOTFOUND");
  });

  it("classifies ETIMEDOUT spawn error as CliTimeoutError", () => {
    const err = new Error("timed out");
    (err as NodeJS.ErrnoException).code = "ETIMEDOUT";

    const result = classifyCliError(err, "", null, null);

    expect(result).toBeInstanceOf(CliTimeoutError);
    expect(result).not.toBeInstanceOf(CliNetworkError);
  });

  it("classifies ENOENT (command not found) as base CliError", () => {
    const err = new Error("spawn twitter ENOENT");
    (err as NodeJS.ErrnoException).code = "ENOENT";

    const result = classifyCliError(err, "", null, null);

    expect(result).toBeInstanceOf(CliError);
    expect(result).not.toBeInstanceOf(CliNetworkError);
    expect(result).not.toBeInstanceOf(CliAuthError);
    expect(result.message).toContain("install with: pip install twitter-cli");
  });

  it("classifies unknown spawn error as CliNetworkError (recoverable)", () => {
    const err = new Error("unknown spawn error");
    (err as NodeJS.ErrnoException).code = "EOTHER";

    const result = classifyCliError(err, "", null, null);

    expect(result).toBeInstanceOf(CliNetworkError);
    expect((result as CliNetworkError).code).toBe("EOTHER");
  });

  // ── Timeout (signal) ───────────────────────────────────────────────

  it("classifies SIGTERM with null exit code as CliTimeoutError", () => {
    const result = classifyCliError(null, "", null, "SIGTERM");

    expect(result).toBeInstanceOf(CliTimeoutError);
    expect(result.message).toBe("Twitter CLI timed out");
  });

  it("does NOT classify SIGTERM with non-null exit code as timeout", () => {
    // If process was killed by SIGTERM but had already exited (unusual edge case)
    const result = classifyCliError(null, "", 0, "SIGTERM");

    // With exit 0 it falls through to the generic error
    expect(result).toBeInstanceOf(CliError);
    expect(result).not.toBeInstanceOf(CliTimeoutError);
  });

  // ── Auth errors ────────────────────────────────────────────────────

  it("classifies exit code 401 as CliAuthError", () => {
    const result = classifyCliError(null, "Unauthorized", 401, null);

    expect(result).toBeInstanceOf(CliAuthError);
    expect(result.message).toBe("Unauthorized");
  });

  it("classifies exit code 403 as CliAuthError", () => {
    const result = classifyCliError(null, "Forbidden", 403, null);

    expect(result).toBeInstanceOf(CliAuthError);
  });

  it("classifies stderr containing 'authentication failed' as CliAuthError", () => {
    const result = classifyCliError(
      null,
      "authentication failed: invalid token",
      1,
      null,
    );

    expect(result).toBeInstanceOf(CliAuthError);
  });

  it("classifies stderr containing 'unauthorized' as CliAuthError", () => {
    const result = classifyCliError(null, "unauthorized", 1, null);

    expect(result).toBeInstanceOf(CliAuthError);
  });

  // ── Rate limit errors ──────────────────────────────────────────────

  it("classifies exit code 429 as CliRateLimitError", () => {
    const result = classifyCliError(null, "Too Many Requests", 429, null);

    expect(result).toBeInstanceOf(CliRateLimitError);
  });

  it("classifies stderr containing 'rate limit' as CliRateLimitError", () => {
    const result = classifyCliError(null, "rate limit exceeded", 1, null);

    expect(result).toBeInstanceOf(CliRateLimitError);
  });

  it("classifies stderr containing 'rate_limit' as CliRateLimitError", () => {
    const result = classifyCliError(
      null,
      "rate_limit: 15 requests per 15 min",
      1,
      null,
    );

    expect(result).toBeInstanceOf(CliRateLimitError);
  });

  it("classifies stderr containing 'too many requests' as CliRateLimitError", () => {
    const result = classifyCliError(null, "too many requests", 1, null);

    expect(result).toBeInstanceOf(CliRateLimitError);
  });

  // ── Generic non-zero exit ──────────────────────────────────────────

  it("classifies unknown non-zero exit as base CliError", () => {
    const result = classifyCliError(null, "some error", 127, null);

    expect(result).toBeInstanceOf(CliError);
    expect(result).not.toBeInstanceOf(CliNetworkError);
    expect(result).not.toBeInstanceOf(CliAuthError);
    expect(result).not.toBeInstanceOf(CliRateLimitError);
    expect(result).not.toBeInstanceOf(CliTimeoutError);
    expect(result.message).toContain("127");
    expect(result.message).toContain("some error");
  });

  it("handles non-zero exit with empty stderr", () => {
    const result = classifyCliError(null, "", 1, null);

    expect(result).toBeInstanceOf(CliError);
    expect(result.message).toContain("exited with code 1");
    expect(result.message).toContain("(no stderr)");
  });

  // ── Null / unknown ─────────────────────────────────────────────────

  it("returns base CliError when nothing matches", () => {
    const result = classifyCliError(null, "", 0, null);

    expect(result).toBeInstanceOf(CliError);
    expect(result.message).toContain("Unknown");
  });

  it("returns base CliError with stderr text when available", () => {
    const result = classifyCliError(null, "something went wrong", 0, null);

    expect(result).toBeInstanceOf(CliError);
    expect(result.message).toBe("something went wrong");
  });
});

// ── getUserFriendlyMessage tests ────────────────────────────────────────────

describe("getUserFriendlyMessage", () => {
  it("returns timeout message for CliTimeoutError", () => {
    const msg = getUserFriendlyMessage(new CliTimeoutError("x", 30000));
    expect(msg).toBe(
      "Twitter CLI timed out — check network or increase timeout",
    );
  });

  it("returns auth message for CliAuthError", () => {
    const msg = getUserFriendlyMessage(new CliAuthError("x"));
    expect(msg).toBe(
      "Twitter CLI auth failed — run 'twitter status' to re-authenticate",
    );
  });

  it("returns rate limit message for CliRateLimitError", () => {
    const msg = getUserFriendlyMessage(new CliRateLimitError("x"));
    expect(msg).toBe("Twitter CLI rate limited — wait a moment and retry");
  });

  it("returns network message for CliNetworkError", () => {
    const msg = getUserFriendlyMessage(new CliNetworkError("x"));
    expect(msg).toBe("Twitter CLI network error — check your connection");
  });

  it("returns parse message for CliParseError", () => {
    const msg = getUserFriendlyMessage(new CliParseError("x"));
    expect(msg).toBe("Twitter CLI returned unexpected output");
  });

  it("returns generic message for base CliError", () => {
    const msg = getUserFriendlyMessage(new CliError("something broke"));
    expect(msg).toBe("Twitter CLI error: something broke");
  });
});
