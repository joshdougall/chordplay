import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { getUsageDb, recordEvent, recentEvents, eventStats } from "@/lib/usage/db";

function makeDb(): Database.Database {
  return getUsageDb(":memory:");
}

describe("recordEvent + recentEvents", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    // Clear all events between tests
    db.exec("DELETE FROM events");
  });

  it("inserts an event and retrieves it", () => {
    recordEvent("user1", "play", { title: "Wish You Were Here", artist: "Pink Floyd" }, db);
    const rows = recentEvents({}, db);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe("user1");
    expect(rows[0].kind).toBe("play");
    const payload = rows[0].payload as Record<string, unknown>;
    expect(payload.title).toBe("Wish You Were Here");
    expect(payload.artist).toBe("Pink Floyd");
  });

  it("round-trips ts as a number", () => {
    const before = Date.now();
    recordEvent("user1", "play", { trackId: "t1" }, db);
    const after = Date.now();
    const rows = recentEvents({}, db);
    expect(rows[0].ts).toBeGreaterThanOrEqual(before);
    expect(rows[0].ts).toBeLessThanOrEqual(after);
  });

  it("returns events in descending order by ts", () => {
    for (let i = 0; i < 3; i++) {
      recordEvent("user1", "play", { n: i }, db);
    }
    const rows = recentEvents({}, db);
    expect(rows.length).toBe(3);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].ts).toBeGreaterThanOrEqual(rows[i].ts);
    }
  });

  it("filters by userId", () => {
    recordEvent("alice", "play", { title: "A" }, db);
    recordEvent("bob", "play", { title: "B" }, db);
    const rows = recentEvents({ userId: "alice" }, db);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe("alice");
  });

  it("filters by kind", () => {
    recordEvent("user1", "play", {}, db);
    recordEvent("user1", "match", { outcome: "hit" }, db);
    const rows = recentEvents({ kind: "match" }, db);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("match");
  });

  it("filters by since", () => {
    const now = Date.now();
    // Insert event with a ts in the past by using a low-level insert
    db.prepare("INSERT INTO events (ts, user_id, kind, payload) VALUES (?, ?, ?, ?)").run(now - 10000, "user1", "play", JSON.stringify({ title: "Old" }));
    db.prepare("INSERT INTO events (ts, user_id, kind, payload) VALUES (?, ?, ?, ?)").run(now, "user1", "play", JSON.stringify({ title: "New" }));
    const rows = recentEvents({ since: now - 1000 }, db);
    expect(rows).toHaveLength(1);
    expect((rows[0].payload as Record<string, unknown>).title).toBe("New");
  });

  it("respects limit and offset", () => {
    for (let i = 0; i < 10; i++) {
      recordEvent("user1", "play", { n: i }, db);
    }
    const page1 = recentEvents({ limit: 5, offset: 0 }, db);
    const page2 = recentEvents({ limit: 5, offset: 5 }, db);
    expect(page1).toHaveLength(5);
    expect(page2).toHaveLength(5);
    // No overlap
    const ids1 = new Set(page1.map(r => r.id));
    const ids2 = new Set(page2.map(r => r.id));
    for (const id of ids2) expect(ids1.has(id)).toBe(false);
  });
});

describe("eventStats", () => {
  let db: Database.Database;
  const FAR_PAST = 0;

  beforeEach(() => {
    db = makeDb();
    db.exec("DELETE FROM events");
  });

  it("counts events by user", () => {
    recordEvent("alice", "play", {}, db);
    recordEvent("alice", "play", {}, db);
    recordEvent("bob", "play", {}, db);
    const stats = eventStats(FAR_PAST, db);
    const alice = stats.byUser.find(u => u.user_id === "alice");
    const bob = stats.byUser.find(u => u.user_id === "bob");
    expect(alice?.count).toBe(2);
    expect(bob?.count).toBe(1);
  });

  it("counts events by kind", () => {
    recordEvent("user1", "play", {}, db);
    recordEvent("user1", "play", {}, db);
    recordEvent("user1", "match", { outcome: "hit" }, db);
    const stats = eventStats(FAR_PAST, db);
    expect(stats.byKind.find(k => k.kind === "play")?.count).toBe(2);
    expect(stats.byKind.find(k => k.kind === "match")?.count).toBe(1);
  });

  it("computes match rate from outcome field", () => {
    recordEvent("user1", "match", { outcome: "hit" }, db);
    recordEvent("user1", "match", { outcome: "hit" }, db);
    recordEvent("user1", "match", { outcome: "miss" }, db);
    const stats = eventStats(FAR_PAST, db);
    expect(stats.matchRate.hit).toBe(2);
    expect(stats.matchRate.miss).toBe(1);
    expect(stats.matchRate.rate).toBeCloseTo(2 / 3, 5);
  });

  it("counts source-based matches as hits", () => {
    recordEvent("user1", "match", { source: "ultimate-guitar" }, db);
    const stats = eventStats(FAR_PAST, db);
    expect(stats.matchRate.hit).toBe(1);
    expect(stats.matchRate.miss).toBe(0);
  });

  it("returns zero match rate when no match events", () => {
    recordEvent("user1", "play", {}, db);
    const stats = eventStats(FAR_PAST, db);
    expect(stats.matchRate.rate).toBe(0);
    expect(stats.matchRate.hit).toBe(0);
    expect(stats.matchRate.miss).toBe(0);
  });

  it("returns top tracks from play events", () => {
    for (let i = 0; i < 3; i++) {
      recordEvent("user1", "play", { title: "Wish You Were Here", artist: "Pink Floyd" }, db);
    }
    recordEvent("user1", "play", { title: "Comfortably Numb", artist: "Pink Floyd" }, db);
    const stats = eventStats(FAR_PAST, db);
    expect(stats.topTracks[0].title).toBe("Wish You Were Here");
    expect(stats.topTracks[0].count).toBe(3);
    expect(stats.topTracks[1].title).toBe("Comfortably Numb");
  });

  it("respects since filter", () => {
    const now = Date.now();
    db.prepare("INSERT INTO events (ts, user_id, kind, payload) VALUES (?, ?, ?, ?)").run(now - 100000, "user1", "play", JSON.stringify({}));
    recordEvent("user1", "play", {}, db);
    const stats = eventStats(now - 1000, db);
    // only 1 recent event should be counted
    expect(stats.byKind.find(k => k.kind === "play")?.count).toBe(1);
  });
});

describe("play dedup (module-level lastSeenTrack)", () => {
  it("recordEvent itself is idempotent per call — dedup is in the route layer", () => {
    const db = makeDb();
    db.exec("DELETE FROM events");
    // Calling recordEvent twice with same payload records two rows (dedup is route-level)
    recordEvent("user1", "play", { trackId: "abc" }, db);
    recordEvent("user1", "play", { trackId: "abc" }, db);
    const rows = recentEvents({ kind: "play" }, db);
    expect(rows.length).toBe(2);
  });
});
