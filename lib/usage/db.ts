import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getConfig } from "@/lib/config";

let dbSingleton: Database.Database | null = null;

export function getUsageDb(explicitPath?: string): Database.Database {
  if (!explicitPath && dbSingleton) return dbSingleton;
  const path = explicitPath ?? join(getConfig().dataPath, "usage.db");
  try { mkdirSync(dirname(path), { recursive: true }); } catch { /* ignore */ }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts);
    CREATE INDEX IF NOT EXISTS idx_events_user_kind_ts ON events (user_id, kind, ts);
  `);
  if (!explicitPath) dbSingleton = db;
  return db;
}

export type EventKind =
  | "play"
  | "match"
  | "save"
  | "edit"
  | "delete"
  | "transpose"
  | "error";

export function recordEvent(
  userId: string,
  kind: EventKind,
  payload: Record<string, unknown>,
  db?: Database.Database
): void {
  const database = db ?? getUsageDb();
  database
    .prepare("INSERT INTO events (ts, user_id, kind, payload) VALUES (?, ?, ?, ?)")
    .run(Date.now(), userId, kind, JSON.stringify(payload));
}

export type EventRow = {
  id: number;
  ts: number;
  user_id: string;
  kind: string;
  payload: unknown;
};

export function recentEvents(
  opts: {
    limit?: number;
    offset?: number;
    userId?: string;
    kind?: string;
    since?: number;
    until?: number;
  } = {},
  db?: Database.Database
): EventRow[] {
  const database = db ?? getUsageDb();
  const wheres: string[] = [];
  const params: (string | number)[] = [];
  if (opts.userId) { wheres.push("user_id = ?"); params.push(opts.userId); }
  if (opts.kind) { wheres.push("kind = ?"); params.push(opts.kind); }
  if (opts.since !== undefined) { wheres.push("ts >= ?"); params.push(opts.since); }
  if (opts.until !== undefined) { wheres.push("ts < ?"); params.push(opts.until); }
  const where = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const rows = database
    .prepare(
      `SELECT id, ts, user_id, kind, payload FROM events ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Array<{
      id: number;
      ts: number;
      user_id: string;
      kind: string;
      payload: string;
    }>;
  return rows.map(r => ({ ...r, payload: JSON.parse(r.payload) }));
}

export function eventStats(
  since: number,
  db?: Database.Database
): {
  byUser: Array<{ user_id: string; count: number }>;
  byKind: Array<{ kind: string; count: number }>;
  topTracks: Array<{ title: string; artist: string; count: number }>;
  matchRate: { hit: number; miss: number; rate: number };
} {
  const database = db ?? getUsageDb();
  const byUser = database
    .prepare(
      "SELECT user_id, COUNT(*) as count FROM events WHERE ts >= ? GROUP BY user_id ORDER BY count DESC"
    )
    .all(since) as Array<{ user_id: string; count: number }>;
  const byKind = database
    .prepare(
      "SELECT kind, COUNT(*) as count FROM events WHERE ts >= ? GROUP BY kind ORDER BY count DESC"
    )
    .all(since) as Array<{ kind: string; count: number }>;
  const topTracks = database
    .prepare(
      `SELECT
         json_extract(payload, '$.title') as title,
         json_extract(payload, '$.artist') as artist,
         COUNT(*) as count
       FROM events
       WHERE ts >= ? AND kind = 'play' AND title IS NOT NULL
       GROUP BY title, artist
       ORDER BY count DESC
       LIMIT 20`
    )
    .all(since) as Array<{ title: string; artist: string; count: number }>;
  const matches = database
    .prepare(
      `SELECT
         SUM(CASE WHEN json_extract(payload, '$.outcome') = 'hit' OR json_extract(payload, '$.source') IS NOT NULL THEN 1 ELSE 0 END) as hits,
         SUM(CASE WHEN json_extract(payload, '$.outcome') = 'miss' THEN 1 ELSE 0 END) as misses
       FROM events
       WHERE ts >= ? AND kind = 'match'`
    )
    .get(since) as { hits: number | null; misses: number | null };
  const hit = matches.hits ?? 0;
  const miss = matches.misses ?? 0;
  return {
    byUser,
    byKind,
    topTracks,
    matchRate: { hit, miss, rate: hit + miss > 0 ? hit / (hit + miss) : 0 },
  };
}
