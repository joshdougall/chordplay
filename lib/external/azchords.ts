// External chord provider: azchords.com
// Classic plain-HTML guitar chord site. No internal search (uses Google CSE),
// so we navigate by finding the artist's letter-page entry, then scanning their
// chords listing for the requested song.

import type { ChordProvider, ExternalChords } from "./provider";
import { logger } from "@/lib/logger";
import { chordsOverLyricsToChordPro } from "./chord-over-lyrics";
import { validateResult } from "./validate";

export const AZCHORDS_ID = "azchords";
export const AZCHORDS_NAME = "AZ Chords";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Max letter-listing pages to scan when searching for an artist.
const MAX_LETTER_PAGES = 15;

async function plainFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn(
        { provider: AZCHORDS_ID, url, status: res.status },
        "azchords plain fetch bad status"
      );
      return null;
    }
    return await res.text();
  } catch (err) {
    logger.warn(
      { provider: AZCHORDS_ID, url, err: (err as Error).message },
      "azchords plain fetch error"
    );
    return null;
  }
}

/** "Morgan Wallen" -> "morganwallen" */
export function artistSlug(artist: string): string {
  return artist.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "One Thing At A Time" -> "onethingatatime" */
export function songSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type ArtistEntry = {
  slug: string;
  id: string;
  href: string; // full relative URL, e.g. /m/morganwallen-tabs-63388.html
};

/** Parse artist entries from a letter-listing page. */
export function parseArtistEntries(html: string): ArtistEntry[] {
  const entries: ArtistEntry[] = [];
  // href="/m/morganwallen-tabs-63388.html"
  const re = /href="(\/[a-z0-9]\/([a-z0-9]+)-(?:tabs|chords)-(\d+)\.html)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    entries.push({ href: m[1], slug: m[2], id: m[3] });
  }
  return entries;
}

/** Scan letter pages to find an artist's ID. Returns null if not found. */
async function findArtistId(
  letter: string,
  slug: string
): Promise<{ id: string; href: string } | null> {
  for (let page = 1; page <= MAX_LETTER_PAGES; page++) {
    const url =
      page === 1
        ? `https://www.azchords.com/${letter}.html`
        : `https://www.azchords.com/${letter}_page_${page}.html`;

    const html = await plainFetch(url);
    if (!html) return null;

    const entries = parseArtistEntries(html);
    if (entries.length === 0) return null; // past last page

    for (const entry of entries) {
      if (entry.slug === slug) {
        return { id: entry.id, href: entry.href };
      }
    }

    // Early exit: if the last entry on this page is alphabetically past our target
    // (only reliable when the list is sorted, which azchords is).
    const lastSlug = entries[entries.length - 1].slug;
    if (lastSlug > slug) return null;
  }
  return null;
}

type SongEntry = {
  title: string;
  url: string; // relative, e.g. /m/morganwallen-tabs-63388/lastnight-tabs-952969.html
};

/** Parse song entries from the artist's chords listing page. */
export function parseSongEntries(html: string): SongEntry[] {
  const entries: SongEntry[] = [];
  // Links look like: <a href="/r/radiohead-tabs-3178/creep-tabs-897462.html">Creep Chords</a>
  // Also dropdown versions: the href is the same pattern
  const re = /href="(\/[a-z0-9]\/[a-z0-9]+-tabs-\d+\/([a-z0-9]+-tabs-\d+\.html))"/gi;
  let m: RegExpExecArray | null;
  // Track seen URLs to avoid duplicates from dropdown markup
  const seen = new Set<string>();
  while ((m = re.exec(html)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      entries.push({ url: m[1], title: m[2] });
    }
  }
  return entries;
}

/**
 * Among the song entries, find the best match for the given song slug.
 * Returns the URL of the best match or null.
 */
export function findBestSong(
  entries: SongEntry[],
  targetSlug: string
): string | null {
  // Song URL slug: e.g. "creep-tabs-897462.html" -> slug portion is "creep"
  for (const entry of entries) {
    // Extract the song slug from URL filename: "creep-tabs-897462.html" -> "creep"
    const fileMatch = entry.url.match(/\/([a-z0-9]+)-tabs-\d+\.html$/);
    if (fileMatch && fileMatch[1] === targetSlug) {
      return entry.url;
    }
  }
  return null;
}

/** Extract artist and title from the azchords page og:title. */
export function parseAzChordsMetadata(
  html: string
): { title: string; artist: string } | null {
  // og:title content is like: "Creep Chords – Radiohead | Version #1"
  const ogTitle = html.match(
    /<meta property="og:title"\s+content="([^"]+)"/i
  );
  if (!ogTitle) return null;
  const raw = ogTitle[1];
  // "Creep Chords – Radiohead | Version #1"
  // Split on em-dash or ndash variants
  const parts = raw.split(/\s*[–—]\s*/);
  if (parts.length < 2) return null;
  const titlePart = parts[0].replace(/\s*[Cc]hords.*$/, "").trim();
  const artistPart = parts[1].replace(/\s*\|.*$/, "").trim();
  return { title: titlePart, artist: artistPart };
}

/** Extract chord content from the azchords song page. */
export function parseAzChordsContent(html: string): string | null {
  // The chord content is always in the 2nd <pre> block (index 1).
  // The 1st pre contains an ad/promo text, the 3rd/4th are also ads.
  const pres: string[] = [];
  const preRe = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let m: RegExpExecArray | null;
  while ((m = preRe.exec(html)) !== null) {
    pres.push(m[1]);
  }
  if (pres.length < 2) return null;

  let raw = pres[1];
  raw = raw.replace(/<[^>]+>/g, ""); // strip HTML tags
  raw = raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove the ad text that sometimes bleeds in from the first pre
  raw = raw
    .split("\n")
    .filter((l) => !l.includes("video lessons") && !l.includes("corrections"))
    .join("\n");

  return raw.trim() || null;
}

async function fetchFn(
  artist: string,
  title: string
): Promise<ExternalChords | null> {
  try {
    const aSlug = artistSlug(artist);
    const sSlug = songSlug(title);
    if (!aSlug) return null;
    const letter = aSlug[0];

    // 1. Find artist page ID by scanning letter pages
    const artistEntry = await findArtistId(letter, aSlug);
    if (!artistEntry) {
      logger.info(
        { provider: AZCHORDS_ID, artist, title, reason: "artist-not-found" },
        "azchords artist not found"
      );
      return null;
    }

    // 2. Fetch the artist's chords listing page
    // href is like "/m/morganwallen-tabs-63388.html"; convert to chords URL
    const chordsHref = artistEntry.href.replace("-tabs-", "-chords-");
    const chordsUrl = `https://www.azchords.com${chordsHref}`;
    const chordsHtml = await plainFetch(chordsUrl);
    if (!chordsHtml) return null;

    // 3. Find the song entry matching our title slug
    const songs = parseSongEntries(chordsHtml);
    const songHref = findBestSong(songs, sSlug);
    if (!songHref) {
      logger.info(
        { provider: AZCHORDS_ID, artist, title, reason: "song-not-found" },
        "azchords song not found"
      );
      return null;
    }

    // 4. Fetch the song page
    const songUrl = `https://www.azchords.com${songHref}`;
    const songHtml = await plainFetch(songUrl);
    if (!songHtml) return null;

    // 5. Extract metadata and validate
    const meta = parseAzChordsMetadata(songHtml);
    if (!meta) return null;

    if (!validateResult({ artist, title }, meta, AZCHORDS_ID)) return null;

    // 6. Extract and convert chord content
    const raw = parseAzChordsContent(songHtml);
    if (!raw) return null;

    const content = chordsOverLyricsToChordPro(raw);

    return {
      source: AZCHORDS_ID,
      sourceName: AZCHORDS_NAME,
      sourceUrl: songUrl,
      content,
      title: meta.title,
      artist: meta.artist,
    };
  } catch (err) {
    logger.warn(
      { provider: AZCHORDS_ID, artist, title, err: (err as Error).message },
      "azchords fetch error"
    );
    return null;
  }
}

export const AzChordsProvider: ChordProvider = {
  id: AZCHORDS_ID,
  name: AZCHORDS_NAME,
  fetch: fetchFn,
};
