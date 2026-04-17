import { ChordieProvider } from "./chordie";
import { EChordsProvider } from "./e-chords";
import type { ExternalChords, ChordProvider } from "./provider";

export const PROVIDERS: ChordProvider[] = [ChordieProvider, EChordsProvider];

type CacheKey = string; // `${providerId}|${normArtist}|${normTitle}`
const cache = new Map<CacheKey, ExternalChords | null>();

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function _resetCacheForTest(): void {
  cache.clear();
}

export async function findChords(
  artist: string,
  title: string,
  providers: ChordProvider[] = PROVIDERS
): Promise<ExternalChords | null> {
  for (const p of providers) {
    const key: CacheKey = `${p.id}|${norm(artist)}|${norm(title)}`;
    if (cache.has(key)) {
      const cached = cache.get(key);
      if (cached) return cached;
      continue;
    }
    try {
      const result = await p.fetch(artist, title);
      cache.set(key, result);
      if (result) return result;
    } catch {
      cache.set(key, null);
    }
  }
  return null;
}
