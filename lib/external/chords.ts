import { ChordieProvider } from "./chordie";
import { UltimateGuitarProvider } from "./ultimate-guitar";
import { ChordifyProvider } from "./chordify";
import { EChordsProvider } from "./e-chords";
import { readCached, writeCached } from "./cache";
import type { ExternalChords, ChordProvider } from "./provider";
import { logger } from "@/lib/logger";

// Providers tried in order. Disabled providers are commented-out rather than
// removed so we can re-enable once we figure out a working strategy.
//
// Status notes (2026-04-18):
//   - chordie: works, narrow catalog (lots of misses for mainstream pop/country)
//   - ultimate-guitar: UG is now a full SPA, content is fetched client-side
//     via authenticated XHR after page load. Server-side HTML has no bootstrap.
//     Even with flaresolverr giving us a 200, there's nothing to parse. Disabled.
//   - chordify: heavy JS render, our markdown-extraction is unreliable. Disabled.
//   - e-chords: Cloudflare managed challenge blocks flaresolverr too. Disabled.
export const PROVIDERS: ChordProvider[] = [
  ChordieProvider,
  // UltimateGuitarProvider,  // see note above
  // ChordifyProvider,
  // EChordsProvider,
];

// Keep imports referenced so unused-import lints don't fire (providers not currently
// in the chain are still imported for potential re-enable).
void UltimateGuitarProvider;
void ChordifyProvider;
void EChordsProvider;

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
        if (cached) {
          logger.info({ provider: p.id, artist, title, outcome: "cached-hit" }, "chords cache hit");
          return cached;
        }
        logger.info({ provider: p.id, artist, title, outcome: "cached-miss" }, "chords negative cache");
        continue; // negative cache
      }
    } else {
      const cached = await readCached(p.id, normArtist, normTitle);
      if (cached !== null) {
        if (cached.result) {
          logger.info({ provider: p.id, artist, title, outcome: "cached-hit" }, "chords disk cache hit");
          return cached.result;
        }
        logger.info({ provider: p.id, artist, title, outcome: "cached-miss" }, "chords disk negative cache");
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
      if (result) {
        logger.info({ provider: p.id, artist, title, outcome: "hit" }, "chords provider hit");
        return result;
      }
      logger.info({ provider: p.id, artist, title, outcome: "miss" }, "chords provider miss");
    } catch (err) {
      logger.error({ provider: p.id, artist, title, outcome: "error", err }, "chords provider error");
      if (isTest) {
        memCache.set(memKey, null);
      } else {
        await writeCached(p.id, normArtist, normTitle, null);
      }
    }
  }
  return null;
}
