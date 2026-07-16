/**
 * Lightweight structured logger for ReplyFlow.
 *
 * Outputs to stderr with format: [ReplyFlow] [LEVEL] message
 * Supports log level filtering, child loggers for module context,
 * and configuration via LOG_LEVEL env var or programmatic setLevel().
 *
 * No external dependencies.
 */

// ── Types ──────────────────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveLogLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (env && env in LOG_LEVELS) return env;
  return "info";
}

// ── Logger class ───────────────────────────────────────────────────────────

class Logger {
  private level: LogLevel;
  private context?: string;

  constructor(level?: LogLevel, context?: string) {
    this.level = level ?? resolveLogLevel();
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private format(level: LogLevel, message: string): string {
    const ctx = this.context ? ` [${this.context}]` : "";
    return `[ReplyFlow] [${level.toUpperCase()}]${ctx} ${message}`;
  }

  private write(level: LogLevel, message: string): void {
    if (!this.shouldLog(level)) return;
    process.stderr.write(this.format(level, message) + "\n");
  }

  debug(message: string): void {
    this.write("debug", message);
  }

  info(message: string): void {
    this.write("info", message);
  }

  warn(message: string): void {
    this.write("warn", message);
  }

  error(message: string): void {
    this.write("error", message);
  }

  /**
   * Create a child logger scoped to a sub-module.
   * The context prefix is added to all log messages.
   */
  child(context: string): Logger {
    const newCtx = this.context ? `${this.context}:${context}` : context;
    return new Logger(this.level, newCtx);
  }

  /**
   * Change the log level at runtime (e.g. after reading config).
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current effective log level.
   */
  getLevel(): LogLevel {
    return this.level;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

const logger = new Logger();
export default logger;
export { Logger };
export type { LogLevel };
