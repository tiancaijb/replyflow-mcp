import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import logger from "./logger.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: number;
  tweetId: string;
  conversationId?: string;
  inReplyToTweetId?: string;
  text: string;
  style?: string;
  copiedAt: string;
  account: string;
  status: "sent" | "replied" | "followed_up";
}

// ── Paths ────────────────────────────────────────────────────────────────────

const HISTORY_DIR = join(homedir(), ".replyflow");
const HISTORY_PATH = join(HISTORY_DIR, "history.json");

export { HISTORY_DIR, HISTORY_PATH };

// ── Internal helpers ─────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!existsSync(HISTORY_DIR)) {
    mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

function readAllEntries(): HistoryEntry[] {
  if (!existsSync(HISTORY_PATH)) {
    logger.debug("History file does not exist yet");
    return [];
  }
  try {
    const raw = readFileSync(HISTORY_PATH, "utf-8");
    const entries = JSON.parse(raw) as HistoryEntry[];
    logger.debug(`Read ${entries.length} history entries`);
    return entries;
  } catch (err) {
    logger.error(
      `Failed to parse history file: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

function writeAllEntries(entries: HistoryEntry[]): void {
  ensureDir();
  writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

function getNextId(entries: HistoryEntry[]): number {
  if (entries.length === 0) return 1;
  return Math.max(...entries.map((e) => e.id)) + 1;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Append a new history entry (called when user copies a reply).
 * Returns the created entry for feedback.
 */
export function appendHistory(
  text: string,
  tweetId?: string,
  style?: string,
  account = "default",
  conversationId?: string,
  inReplyToTweetId?: string,
): HistoryEntry {
  const entries = readAllEntries();
  const id = getNextId(entries);
  const entry: HistoryEntry = {
    id,
    tweetId: tweetId ?? "",
    conversationId,
    inReplyToTweetId,
    text,
    style,
    copiedAt: new Date().toISOString(),
    account,
    status: "sent",
  };
  entries.push(entry);
  writeAllEntries(entries);
  logger.debug(
    `Appended history entry ${id} for tweet ${tweetId ?? "(no id)"}`,
  );
  return entry;
}

/**
 * Read history entries, sorted by most recent first.
 * Optionally filter by tweetId, status and limit count.
 */
export function readHistory(
  tweetId?: string,
  limit = 20,
  status?: "sent" | "replied" | "followed_up",
): HistoryEntry[] {
  let entries = readAllEntries();

  // Sort newest first
  entries.sort(
    (a, b) => new Date(b.copiedAt).getTime() - new Date(a.copiedAt).getTime(),
  );

  if (tweetId) {
    entries = entries.filter((e) => e.tweetId === tweetId);
  }

  if (status) {
    entries = entries.filter((e) => e.status === status);
  }

  return entries.slice(0, limit);
}

/**
 * Get the set of tweet IDs that have been replied to.
 */
export function getRepliedTweetIds(): Set<string> {
  const entries = readAllEntries();
  return new Set(entries.map((e) => e.tweetId).filter(Boolean));
}

// ── Reply chain tracking ─────────────────────────────────────────────────────

/**
 * Check for new replies on tweets we've sent replies to.
 *
 * For each entry with status "sent", fetches the tweet thread via
 * `twitter tweet <tweetId>` and checks if there are replies from
 * users other than the authenticated user.
 *
 * @param getThread   Function that fetches a tweet thread by ID.
 *                    Defaults to importing from twitter.ts.
 *                    Made injectable for testability.
 * @param myUserId    The authenticated user's Twitter ID (optional).
 * @returns           Array of entries whose status changed to "replied".
 */
export function checkForReplies(
  getThread?: (
    tweetId: string,
  ) => { authorId: string; replies: { authorId: string }[] } | null,
  myUserId?: string,
): HistoryEntry[] {
  // Lazy import to avoid circular dependency at module level
  const fetcher: NonNullable<typeof getThread> =
    getThread ??
    ((tweetId: string) => {
      try {
        // Dynamic require to avoid top-level import issues
        const { getTweetWithReplies } = require("./twitter.js");
        const data = getTweetWithReplies(tweetId);
        if (!data || data.length === 0) return null;
        return {
          authorId: data[0]?.author?.id ?? "",
          replies: data.slice(1).map((r: { author?: { id: string } }) => ({
            authorId: r.author?.id ?? "",
          })),
        };
      } catch {
        return null;
      }
    });

  const entries = readAllEntries();
  const sentEntries = entries.filter((e) => e.status === "sent" && e.tweetId);
  const updated: HistoryEntry[] = [];

  for (const entry of sentEntries) {
    const thread = fetcher(entry.tweetId);
    if (!thread) continue;

    const originalAuthorId = thread.authorId;

    // Check if any reply is from someone other than the original author and not us
    const hasExternalReply = thread.replies.some(
      (r) =>
        r.authorId !== originalAuthorId &&
        r.authorId !== (myUserId ?? "") &&
        r.authorId !== "",
    );

    if (hasExternalReply) {
      entry.status = "replied";
      updated.push(entry);
    }
  }

  if (updated.length > 0) {
    writeAllEntries(entries);
    logger.debug(`Updated ${updated.length} entries to replied status`);
  }

  return updated;
}

/**
 * Get all entries that need follow-up (status is "replied").
 */
export function getFollowUpTweets(): HistoryEntry[] {
  const entries = readAllEntries();
  return entries
    .filter((e) => e.status === "replied")
    .sort(
      (a, b) => new Date(b.copiedAt).getTime() - new Date(a.copiedAt).getTime(),
    );
}

/**
 * Update the status of a history entry by ID.
 * Returns the updated entry, or undefined if not found.
 */
export function updateEntryStatus(
  id: number,
  status: "sent" | "replied" | "followed_up",
): HistoryEntry | undefined {
  const entries = readAllEntries();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return undefined;

  entry.status = status;
  writeAllEntries(entries);
  return entry;
}

/**
 * Mark a follow-up tweet as "followed_up" (already actioned).
 * Convenience wrapper around updateEntryStatus.
 */
export function markAsFollowedUp(id: number): HistoryEntry | undefined {
  return updateEntryStatus(id, "followed_up");
}
