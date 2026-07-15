import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: number;
  tweetId: string;
  text: string;
  style?: string;
  copiedAt: string;
  account: string;
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
  if (!existsSync(HISTORY_PATH)) return [];
  try {
    const raw = readFileSync(HISTORY_PATH, "utf-8");
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
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
): HistoryEntry {
  const entries = readAllEntries();
  const id = getNextId(entries);
  const entry: HistoryEntry = {
    id,
    tweetId: tweetId ?? "",
    text,
    style,
    copiedAt: new Date().toISOString(),
    account,
  };
  entries.push(entry);
  writeAllEntries(entries);
  return entry;
}

/**
 * Read history entries, sorted by most recent first.
 * Optionally filter by tweetId and limit count.
 */
export function readHistory(tweetId?: string, limit = 20): HistoryEntry[] {
  let entries = readAllEntries();

  // Sort newest first
  entries.sort(
    (a, b) => new Date(b.copiedAt).getTime() - new Date(a.copiedAt).getTime(),
  );

  if (tweetId) {
    entries = entries.filter((e) => e.tweetId === tweetId);
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
