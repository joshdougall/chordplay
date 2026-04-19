import { ChordieProvider } from "./chordie";
import { UltimateGuitarProvider } from "./ultimate-guitar";
import { UltimateGuitarApiProvider } from "./ultimate-guitar-api";
import { ChordifyProvider } from "./chordify";
import { EChordsProvider } from "./e-chords";
import { SongsterrProvider } from "./songsterr";
import { AzChordsProvider } from "./azchords";
import { GuitarTabsCcProvider } from "./guitartabs";
import { GuitareTabProvider } from "./guitaretab";
import { readCached, writeCached } from "./cache";
import type { ExternalChords, ChordProvider } from "./provider";
import { logger } from "@/lib/logger";

// Providers tried in order. Disabled providers are commented-out rather than
// removed so we can re-enable once we figure out a working strategy.
//
// Status notes (2026-04-19):
//   - chordie: works, narrow catalog (lots of misses for mainstream pop/country)
//   - azchords: plain HTML, broad catalog, navigates letter pages to find artist
//   - guitartabs-cc: plain HTML, older catalog (~2000s), direct URL construction
//   - guitaretab: plain HTML, moderate catalog, artist-page navigation
//   - ultimate-guitar-api: UG unofficial mobile API — no scraping, pure JSON.
//     Signs requests with MD5(deviceId + "YYYY-MM-DD:H" + "createLog()").
//     No account or API key required; works as of 2026-04-19.
//   - ultimate-guitar (HTML scraper): UG is a full SPA, server-side HTML has no
//     bootstrap even with flaresolverr. Superseded by ultimate-guitar-api. Disabled.
//   - chordify: heavy JS render, our markdown-extraction is unreliable. Disabled.
//   - e-chords: Cloudflare managed challenge blocks flaresolverr too. Disabled.
//   - songsterr: clean public JSON API. Tab data is GP5 binary (out of scope to
//     parse for v1), so we return a stub linking out to the Songsterr viewer.
//     Listed last — prefer real chord content from other providers first.
export const PROVIDERS: ChordProvider[] = [
  // Broadest catalog first. UG mobile API covers mainstream pop/country where the
  // other sites typically miss, so try it early.
  UltimateGuitarApiProvider,
  ChordieProvider,
  AzChordsProvider,
  GuitareTabProvider,
  GuitarTabsCcProvider,
  SongsterrProvider,  // stub-only — last resort
  // UltimateGuitarProvider,  // see note above — superseded by UltimateGuitarApiProvider
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
