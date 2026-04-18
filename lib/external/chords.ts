import { ChordieProvider } from "./chordie";
import { UltimateGuitarProvider } from "./ultimate-guitar";
import { ChordifyProvider } from "./chordify";
import { EChordsProvider } from "./e-chords";
import { readCached, writeCached } from "./cache";
import type { ExternalChords, ChordProvider } from "./provider";

export const PROVIDERS: ChordProvider[] = [
  ChordieProvider,        // fast, no auth
  UltimateGuitarProvider, // firecrawl, best catalog
  ChordifyProvider,       // firecrawl, broad coverage
  EChordsProvider,        // cloudflare-blocked but keep for future
];

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// In-memory cache used during tests (disk cache is bypassed when NODE_ENV=test).
type CacheKey = string; // `${providerId}|${normArtist}|${normTitle}`
const memCache = new Map<CacheKey, ExternalChords | null>();

export function _resetCacheForTest(): void {
  memCache.clear();
}

export async function findChords(
  artist: string,
  title: string,
  providers: ChordProvider[] = PROVIDERS
): Promise<ExternalChords | null> {
  const normArtist = norm(artist);
  const normTitle = norm(title);
  const isTest = process.env.NODE_ENV === "test";

  for (const p of providers) {
    const memKey: CacheKey = `${p.id}|${normArtist}|${normTitle}`;

    // In test mode use the in-memory cache; otherwise use disk cache.
    if (isTest) {
      if (memCache.has(memKey)) {
        const cached = memCache.get(memKey);
        if (cached) return cached;
        continue; // negative cache
      }
    } else {
      const cached = await readCached(p.id, normArtist, normTitle);
      if (cached !== null) {
        if (cached.result) return cached.result;
        continue; // negative cache
      }
    }

    try {
      const result = await p.fetch(artist, title);
      if (isTest) {
        memCache.set(memKey, result);
      } else {
        await writeCached(p.id, normArtist, normTitle, result);
      }
      if (result) return result;
    } catch {
      if (isTest) {
        memCache.set(memKey, null);
      } else {
        await writeCached(p.id, normArtist, normTitle, null);
      }
    }
  }
  return null;
}
