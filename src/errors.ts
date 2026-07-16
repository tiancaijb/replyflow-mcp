/**
 * Error classes and classification for twitter-cli.
 *
 * Defines a hierarchy of CliError types and a classifier function
 * that translates raw spawn/exit errors into typed, user-friendly errors.
 */

// ── Base Error ──────────────────────────────────────────────────────────────

/**
 * Base error class for all twitter-cli related errors.
 */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

// ── Specific Error Types ────────────────────────────────────────────────────

/**
 * The twitter-cli process timed out.
 */
export class CliTimeoutError extends CliError {
  /** The timeout value in ms that was exceeded. */
  timeout: number;

  constructor(message: string, timeout: number) {
    super(message);
    this.name = "CliTimeoutError";
    this.timeout = timeout;
  }
}

/**
 * Authentication/authorization failed (401, 403, or auth-related stderr).
 */
export class CliAuthError extends CliError {
  constructor(message: string) {
    super(message);
    this.name = "CliAuthError";
  }
}

/**
 * Rate limited by Twitter API (429 or rate-limit stderr).
 */
export class CliRateLimitError extends CliError {
  constructor(message: string) {
    super(message);
    this.name = "CliRateLimitError";
  }
}

/**
 * Network-level error (ECONNRESET, ENOTFOUND, etc.).
 * These are considered recoverable and trigger automatic retries.
 */
export class CliNetworkError extends CliError {
  /** The OS-level error code, e.g. 'ECONNRESET', 'ENOTFOUND'. */
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "CliNetworkError";
    this.code = code;
  }
}

/**
 * Failed to parse the JSON output from twitter-cli.
 */
export class CliParseError extends CliError {
  constructor(message: string) {
    super(message);
    this.name = "CliParseError";
  }
}

// ── Classification ──────────────────────────────────────────────────────────

/**
 * Classify a twitter-cli error into a specific CliError subclass.
 *
 * @param err      The error object from spawnSync (set when the process
 *                 could not be spawned — ENOENT, ECONNRESET, etc.).
 * @param stderr   The stderr output from the process.
 * @param exitCode The exit code of the process (null if terminated by signal).
 * @param signal   The signal that terminated the process (null if exited).
 */
export function classifyCliError(
  err: Error | null,
  stderr: string,
  exitCode: number | null,
  signal: string | null,
): CliError {
  // ── 1) Spawn errors (process never ran) ────────────────────────────
  if (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    const code = nodeErr.code;

    // Timeout from spawnSync itself (Node ≥ 18 sets code: 'ETIMEDOUT')
    if (code === "ETIMEDOUT") {
      return new CliTimeoutError(
        `Twitter CLI timed out (${code})`,
        0, // actual timeout is tracked at the call site
      );
    }

    // Recoverable network errors
    if (code === "ECONNRESET" || code === "ENOTFOUND") {
      return new CliNetworkError(err.message, code);
    }

    // Command not found — not recoverable
    if (code === "ENOENT") {
      return new CliError(
        `Twitter CLI not found — install with: pip install twitter-cli\n(${err.message})`,
      );
    }

    // Generic spawn failure — treat as network error (recoverable)
    return new CliNetworkError(
      err.message || "Failed to spawn twitter-cli",
      code,
    );
  }

  // ── 2) Process killed by signal (likely timeout) ─────────────────────
  if (signal === "SIGTERM" && exitCode === null) {
    return new CliTimeoutError("Twitter CLI timed out", 0);
  }

  // ── 3) Non-zero exit code ──────────────────────────────────────────
  if (exitCode !== null && exitCode !== 0) {
    const lowerStderr = stderr.toLowerCase();

    // Auth errors
    if (
      exitCode === 401 ||
      exitCode === 403 ||
      lowerStderr.includes("401") ||
      lowerStderr.includes("403") ||
      lowerStderr.includes("unauthorized") ||
      lowerStderr.includes("authentication failed") ||
      lowerStderr.includes("auth failed") ||
      lowerStderr.includes("auth error")
    ) {
      return new CliAuthError(
        stderr.trim() || `Twitter CLI auth failed (exit code ${exitCode})`,
      );
    }

    // Rate limit errors
    if (
      exitCode === 429 ||
      lowerStderr.includes("429") ||
      lowerStderr.includes("rate limit") ||
      lowerStderr.includes("rate_limit") ||
      lowerStderr.includes("too many requests")
    ) {
      return new CliRateLimitError(
        stderr.trim() || `Twitter CLI rate limited (exit code ${exitCode})`,
      );
    }

    // Generic non-zero exit
    return new CliError(
      `Twitter CLI exited with code ${exitCode}: ${stderr.trim() || "(no stderr)"}`,
    );
  }

  // ── 4) Parse error (JSON.parse throws) is handled by the caller,
  //      but catch any remaining edge cases here ─────────────────────

  return new CliError(stderr.trim() || "Unknown twitter-cli error");
}

/**
 * Return a user-facing message for a classified CliError.
 *
 * These messages are designed to be shown in tool responses or logs,
 * giving the user actionable guidance.
 */
export function getUserFriendlyMessage(error: CliError): string {
  if (error instanceof CliTimeoutError) {
    return "Twitter CLI timed out — check network or increase timeout";
  }
  if (error instanceof CliAuthError) {
    return "Twitter CLI auth failed — run 'twitter status' to re-authenticate";
  }
  if (error instanceof CliRateLimitError) {
    return "Twitter CLI rate limited — wait a moment and retry";
  }
  if (error instanceof CliNetworkError) {
    return "Twitter CLI network error — check your connection";
  }
  if (error instanceof CliParseError) {
    return "Twitter CLI returned unexpected output";
  }
  return `Twitter CLI error: ${error.message}`;
}
