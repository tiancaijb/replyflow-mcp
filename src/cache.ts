import logger from "./logger.js";

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Default TTL for cache entries (in ms).
 * Override via REPLYFLOW_CACHE_TTL environment variable (in seconds).
 */
function getDefaultTTL(): number {
  const env = process.env.REPLYFLOW_CACHE_TTL;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed * 1000;
  }
  return 60_000; // 60s default
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// ── CacheStore ───────────────────────────────────────────────────────────────

/** In-memory TTL cache. Thread-safe for single-thread Node.js. */
export class CacheStore {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTTL: number;

  constructor(ttlMs?: number) {
    this.defaultTTL = ttlMs ?? getDefaultTTL();
  }

  /**
   * Get a value from cache.
   * Returns undefined if the key doesn't exist or has expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      logger.debug(`Cache MISS: ${key}`);
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      logger.debug(`Cache EXPIRED: ${key}`);
      return undefined;
    }
    logger.debug(`Cache HIT: ${key}`);
    return entry.value as T;
  }

  /**
   * Set a value in cache with optional TTL override (in ms).
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
    logger.debug(`Cache SET: ${key} (ttl=${ttl}ms)`);
  }

  /**
   * Delete a single key from cache.
   */
  delete(key: string): void {
    this.store.delete(key);
    logger.debug(`Cache DELETE: ${key}`);
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    const count = this.store.size;
    this.store.clear();
    logger.debug(`Cache CLEAR: ${count} entries removed`);
  }

  /**
   * Get all cache keys (for inspection/debugging).
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Delete all keys matching a predicate.
   * Useful for targeted invalidation (e.g., clear only search cache).
   */
  filter(predicate: (key: string) => boolean): void {
    for (const key of this.store.keys()) {
      if (predicate(key)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get the number of entries currently in cache.
   */
  get size(): number {
    return this.store.size;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

/** Global cache instance shared across the application. */
export const cache = new CacheStore();
