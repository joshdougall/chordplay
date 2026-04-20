import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { getConfig } from "../config";
import type { ExternalChords } from "./provider";

type CacheEntry = { result: ExternalChords | null; at: number };

const NEG_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d negative cache
const POS_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90d positive cache

function cacheKey(provider: string, artist: string, title: string): string {
  const normalized = `${provider}|${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export async function readCached(
  provider: string,
  artist: string,
  title: string
): Promise<CacheEntry | null> {
  if (process.env.NODE_ENV === "test") return null;
  const cfg = getConfig();
  const path = join(cfg.dataPath, "cache", "chords", `${cacheKey(provider, artist, title)}.json`);
  try {
    const raw = await readFile(path, "utf8");
    const entry = JSON.parse(raw) as CacheEntry;
    const ttl = entry.result ? POS_TTL_MS : NEG_TTL_MS;
    if (Date.now() - entry.at > ttl) return null;
    return entry;
  } catch {
    return null;
  }
}

export async function writeCached(
  provider: string,
  artist: string,
  title: string,
  result: ExternalChords | null
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  const cfg = getConfig();
  const dir = join(cfg.dataPath, "cache", "chords");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${cacheKey(provider, artist, title)}.json`);
  const entry: CacheEntry = { result, at: Date.now() };
  await writeFile(path, JSON.stringify(entry), "utf8");
}
