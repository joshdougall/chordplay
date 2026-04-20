// External chord provider: guitartabs.cc
// Classic plain-HTML guitar tab site. No working search endpoint.
// We derive the artist/song slugs directly and construct the URL.
// Fallback: fetch the artist listing page and scan for a matching song.

import type { ChordProvider, ExternalChords } from "./provider";
import { logger } from "@/lib/logger";
import { chordsOverLyricsToChordPro } from "./chord-over-lyrics";
import { validateResult } from "./validate";

export const GUITARTABS_ID = "guitartabs-cc";
export const GUITARTABS_NAME = "GuitarTabs.cc";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
        { provider: GUITARTABS_ID, url, status: res.status },
        "guitartabs plain fetch bad status"
      );
      return null;
    }
    return await res.text();
  } catch (err) {
    logger.warn(
      { provider: GUITARTABS_ID, url, err: (err as Error).message },
      "guitartabs plain fetch error"
    );
    return null;
  }
}

/**
 * Convert artist or song name to guitartabs.cc slug:
 * lowercase, spaces and hyphens become underscores, all other non-alphanumeric removed.
 * "Morgan Wallen" -> "morgan_wallen"
 * "One Thing At A Time" -> "one_thing_at_a_time"
 */
export function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Extract artist and title from guitartabs.cc og:title "Artist - Song Chords & Tabs". */
export function parseGuitarTabsMeta(
  html: string
): { title: string; artist: string } | null {
  const og = html.match(/<meta property="og:title"\s+content="([^"]+)"/i);
  if (!og) return null;
  const raw = og[1];
  // "Radiohead - Creep Chords & Tabs"
  const dashIdx = raw.indexOf(" - ");
  if (dashIdx === -1) return null;
  const artist = raw.slice(0, dashIdx).trim();
  const title = raw
    .slice(dashIdx + 3)
    .replace(/\s+Chords.*$/, "")
    .trim();
  return { artist, title };
}

/** Extract chord content from the second <pre> block on a guitartabs.cc page. */
export function parseGuitarTabsContent(html: string): string | null {
  const pres: string[] = [];
  const preRe = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let m: RegExpExecArray | null;
  while ((m = preRe.exec(html)) !== null) {
    pres.push(m[1]);
  }
  if (pres.length < 2) return null;

  let raw = pres[1];
  raw = raw.replace(/<[^>]+>/g, "");
  raw = raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return raw.trim() || null;
}

/**
 * Scan the artist listing page for a chord page matching the target song slug.
 * Returns the href or null.
 */
export function findSongInArtistPage(
  html: string,
  artistSlug: string,
  targetSongSlug: string
): string | null {
  // Chord links: /tabs/<letter>/<artist>/<song>_crd.html (also _crd_ver_2.html etc.)
  const re = new RegExp(
    `href="(/tabs/[a-z0-9]/${artistSlug}/([^"]+_crd[^"]*\\.html))"`,
    "gi"
  );
  let m: RegExpExecArray | null;
  let firstMatch: string | null = null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const filename = m[2]; // e.g. "one_thing_at_a_time_crd.html"
    // Extract the song slug from the filename (strip "_crd" and version suffix)
    const slugPart = filename.replace(/_crd.*\.html$/, "");
    if (slugPart === targetSongSlug) {
      return href;
    }
    if (firstMatch === null) firstMatch = href;
  }
  return null;
}

async function fetchFn(
  artist: string,
  title: string
): Promise<ExternalChords | null> {
  try {
    const aSlug = toSlug(artist);
    const sSlug = toSlug(title);
    if (!aSlug || !sSlug) return null;
    const letter = aSlug[0];

    // 1. Try the direct URL first
    const directUrl = `https://www.guitartabs.cc/tabs/${letter}/${aSlug}/${sSlug}_crd.html`;
    let songHtml = await plainFetch(directUrl);
    let songUrl = directUrl;

    // 2. If direct URL fails, scan the artist listing page
    if (!songHtml) {
      const artistUrl = `https://www.guitartabs.cc/tabs/${letter}/${aSlug}/`;
      const artistHtml = await plainFetch(artistUrl);
      if (!artistHtml) {
        logger.info(
          {
            provider: GUITARTABS_ID,
            artist,
            title,
            reason: "artist-page-not-found",
          },
          "guitartabs artist page not found"
        );
        return null;
      }
      const foundHref = findSongInArtistPage(artistHtml, aSlug, sSlug);
      if (!foundHref) {
        logger.info(
          {
            provider: GUITARTABS_ID,
            artist,
            title,
            reason: "song-not-found-in-artist-page",
          },
          "guitartabs song not found"
        );
        return null;
      }
      songUrl = `https://www.guitartabs.cc${foundHref}`;
      songHtml = await plainFetch(songUrl);
      if (!songHtml) return null;
    }

    // 3. Extract metadata and validate
    const meta = parseGuitarTabsMeta(songHtml);
    if (!meta) {
      // Might be a 404 page without og:title
      logger.info(
        { provider: GUITARTABS_ID, artist, title, reason: "no-metadata" },
        "guitartabs no metadata on page"
      );
      return null;
    }

    if (!validateResult({ artist, title }, meta, GUITARTABS_ID)) return null;

    // 4. Extract chord content
    const raw = parseGuitarTabsContent(songHtml);
    if (!raw) return null;

    // 5. Convert chord-over-lyrics to ChordPro
    const content = chordsOverLyricsToChordPro(raw);

    return {
      source: GUITARTABS_ID,
      sourceName: GUITARTABS_NAME,
      sourceUrl: songUrl,
      content,
      title: meta.title,
      artist: meta.artist,
    };
  } catch (err) {
    logger.warn(
      { provider: GUITARTABS_ID, artist, title, err: (err as Error).message },
      "guitartabs fetch error"
    );
    return null;
  }
}

export const GuitarTabsCcProvider: ChordProvider = {
  id: GUITARTABS_ID,
  name: GUITARTABS_NAME,
  fetch: fetchFn,
};
