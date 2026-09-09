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
import { cleanTitleForSearch, cleanArtistForSearch } from "./clean-title";
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

/**
 * Record where a fetched sheet came from, as a ChordPro directive.
 *
 * A directive rather than a prose line on purpose: stripMetaPreamble keeps every
 * directive, but strips a "Source: ..." label (it is in its LABELLED_META set)
 * and strips bare URLs as credit lines. So prose would vanish at render time.
 *
 * Injected here rather than in each provider so all six get it from the one
 * place sourceUrl is already part of the contract.
 */
export function withSourceDirective(content: string, sourceUrl: string): string {
  if (!sourceUrl) return content;
  if (!/^https?:\/\//i.test(sourceUrl)) return content;
  if (/^\s*\{\s*source\s*:/im.test(content)) return content;

  const directive = `{source: ${sourceUrl}}`;
  const lines = content.split("\n");

  // Sit with the other directives at the top, if there are any.
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "") continue;
    if (/^\{[^}]+\}$/.test(t)) { last = i; continue; }
    break;
  }
  if (last === -1) return `${directive}\n${content}`;
  lines.splice(last + 1, 0, directive);
  return lines.join("\n");
}

// In-memory cache used during tests (disk cache is bypassed when NODE_ENV=test).
type CacheKey = string; // `${providerId}|${normArtist}|${normTitle}`
const memCache = new Map<CacheKey, ExternalChords | null>();

export function _resetCacheForTest(): void {
  memCache.clear();
}

export async function findChords(
  rawArtist: string,
  rawTitle: string,
  providers: ChordProvider[] = PROVIDERS
): Promise<ExternalChords | null> {
  // Strip Spotify-style suffixes ("- Remastered 2015", "(feat. X)", "- Bonus Track",
  // etc.) before calling providers. The underlying song is what we want;
  // providers + validators should see the clean title.
  const title = cleanTitleForSearch(rawTitle);
  const artist = cleanArtistForSearch(rawArtist);
  if (title !== rawTitle || artist !== rawArtist) {
    logger.info({ rawArtist, rawTitle, artist, title }, "normalized external query");
  }
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
      const withSource = result
        ? { ...result, content: withSourceDirective(result.content, result.sourceUrl) }
        : result;
      if (isTest) {
        memCache.set(memKey, withSource);
      } else {
        await writeCached(p.id, normArtist, normTitle, withSource);
      }
      if (withSource) {
        logger.info({ provider: p.id, artist, title, outcome: "hit" }, "chords provider hit");
        return withSource;
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
