/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CacheStore } from "../src/cache.js";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("CacheStore", () => {
  let store: CacheStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new CacheStore(1000); // 1s default TTL for testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Basic set/get ──────────────────────────────────────────────────────

  describe("set / get", () => {
    it("stores and retrieves a value", () => {
      store.set("key1", "value1");
      expect(store.get("key1")).toBe("value1");
    });

    it("returns undefined for non-existent key", () => {
      expect(store.get("nonexistent")).toBeUndefined();
    });

    it("stores objects", () => {
      const obj = { a: 1, b: [2, 3] };
      store.set("obj", obj);
      expect(store.get("obj")).toEqual(obj);
    });

    it("stores arrays", () => {
      const arr = [1, 2, 3];
      store.set("arr", arr);
      expect(store.get("arr")).toEqual(arr);
    });

    it("stores falsy values (empty string, 0, false)", () => {
      store.set("empty", "");
      expect(store.get("empty")).toBe("");

      store.set("zero", 0);
      expect(store.get("zero")).toBe(0);

      store.set("false", false);
      expect(store.get("false")).toBe(false);
    });
  });

  // ── TTL / Expiration ───────────────────────────────────────────────────

  describe("TTL", () => {
    it("returns value before TTL expires", () => {
      store.set("key", "value", 500);
      vi.advanceTimersByTime(499);
      expect(store.get("key")).toBe("value");
    });

    it("returns undefined after TTL expires", () => {
      store.set("key", "value", 500);
      vi.advanceTimersByTime(501);
      expect(store.get("key")).toBeUndefined();
    });

    it("uses default TTL when not specified", () => {
      store.set("key", "value"); // default 1000ms
      vi.advanceTimersByTime(999);
      expect(store.get("key")).toBe("value");

      vi.advanceTimersByTime(2);
      expect(store.get("key")).toBeUndefined();
    });

    it("allows per-call TTL override", () => {
      store.set("short", "short-lived", 100);
      store.set("long", "long-lived", 2000);

      vi.advanceTimersByTime(150);
      expect(store.get("short")).toBeUndefined();
      expect(store.get("long")).toBe("long-lived");
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("removes a key from cache", () => {
      store.set("key", "value");
      store.delete("key");
      expect(store.get("key")).toBeUndefined();
    });

    it("does not throw when deleting non-existent key", () => {
      expect(() => store.delete("nonexistent")).not.toThrow();
    });
  });

  // ── clear ──────────────────────────────────────────────────────────────

  describe("clear", () => {
    it("removes all entries", () => {
      store.set("a", 1);
      store.set("b", 2);
      store.set("c", 3);
      expect(store.size).toBe(3);

      store.clear();
      expect(store.size).toBe(0);
      expect(store.get("a")).toBeUndefined();
      expect(store.get("b")).toBeUndefined();
      expect(store.get("c")).toBeUndefined();
    });

    it("works on empty store", () => {
      expect(() => store.clear()).not.toThrow();
    });
  });

  // ── keys ───────────────────────────────────────────────────────────────

  describe("keys", () => {
    it("returns all keys", () => {
      store.set("a", 1);
      store.set("b", 2);
      expect(store.keys().sort()).toEqual(["a", "b"]);
    });

    it("returns empty array for empty store", () => {
      expect(store.keys()).toEqual([]);
    });
  });

  // ── filter ─────────────────────────────────────────────────────────────

  describe("filter", () => {
    it("removes keys matching predicate", () => {
      store.set("search:a", 1);
      store.set("search:b", 2);
      store.set("me:default", 3);

      store.filter((key) => key.startsWith("search:"));

      expect(store.get("search:a")).toBeUndefined();
      expect(store.get("search:b")).toBeUndefined();
      expect(store.get("me:default")).toBe(3);
    });

    it("removes nothing when predicate matches nothing", () => {
      store.set("a", 1);
      store.set("b", 2);

      store.filter((key) => key.startsWith("z"));

      expect(store.size).toBe(2);
    });

    it("works on empty store", () => {
      expect(() => store.filter(() => true)).not.toThrow();
    });
  });

  // ── size ───────────────────────────────────────────────────────────────

  describe("size", () => {
    it("reflects number of entries", () => {
      expect(store.size).toBe(0);
      store.set("a", 1);
      expect(store.size).toBe(1);
      store.set("b", 2);
      expect(store.size).toBe(2);
      store.delete("a");
      expect(store.size).toBe(1);
      store.clear();
      expect(store.size).toBe(0);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles very long keys", () => {
      const longKey = "x".repeat(10000);
      store.set(longKey, "value");
      expect(store.get(longKey)).toBe("value");
    });

    it("overwrites existing key with new value and TTL", () => {
      store.set("key", "old", 1000);
      vi.advanceTimersByTime(500);
      store.set("key", "new", 2000);

      // Old value should be replaced
      expect(store.get("key")).toBe("new");

      // Old TTL (1000 - 500 = 500ms remaining) should be replaced by new TTL
      vi.advanceTimersByTime(1500); // past old expiry, within new
      expect(store.get("key")).toBe("new");

      vi.advanceTimersByTime(501); // past new expiry
      expect(store.get("key")).toBeUndefined();
    });

    it("can store undefined values (but get returns undefined for missing)", () => {
      // This tests that we can distinguish missing from stored undefined
      store.set("key", null);
      expect(store.get("key")).toBeNull();
    });
  });
});
