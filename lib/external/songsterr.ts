// External chord fallback via Songsterr.
// Songsterr exposes a clean public JSON API for search. Tab data is Guitar Pro
// format (GP5 binary), which requires a heavy parser — out of scope for v1.
// Instead we produce a short ascii-tab stub that links out to the Songsterr
// viewer, where users can see and play the tab with full GP5 playback.

import type { ExternalChords, ChordProvider } from "./provider";
import { levenshteinRatio, normalizeField } from "@/lib/library/normalize";
import { logger } from "@/lib/logger";

export const SONGSTERR_ID = "songsterr";
export const SONGSTERR_NAME = "Songsterr";

// Minimum Levenshtein similarity for both title and artist to accept a result.
const MATCH_THRESHOLD = 0.60;

type SongsterrSong = {
  songId: number;
  artist: string;
  title: string;
  hasChords: boolean;
};

// Exported for unit testing.
export async function searchSongsterr(
  artist: string,
  title: string
): Promise<SongsterrSong[] | null> {
  const query = `${artist} ${title}`.trim();
  const url = `https://www.songsterr.com/api/songs?pattern=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "chordplay/0.7.7" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return null;
    return (data as Record<string, unknown>[]).map(d => ({
      songId: d.songId as number,
      artist: String(d.artist ?? ""),
      title: String(d.title ?? ""),
      hasChords: d.hasChords === true,
    }));
  } catch (err) {
    logger.warn(
      { provider: SONGSTERR_ID, err: (err as Error).message },
      "songsterr search error"
    );
    return null;
  }
}

// Exported for unit testing.
export function validateSongsterrResult(
  gotTitle: string,
  gotArtist: string,
  wantTitle: string,
  wantArtist: string
): boolean {
  const titleRatio = levenshteinRatio(normalizeField(gotTitle), normalizeField(wantTitle));
  const artistRatio = levenshteinRatio(normalizeField(gotArtist), normalizeField(wantArtist));
  if (titleRatio < MATCH_THRESHOLD || artistRatio < MATCH_THRESHOLD) {
    logger.info(
      { gotTitle, gotArtist, wantTitle, wantArtist, titleRatio, artistRatio },
      "songsterr validator rejected result"
    );
    return false;
  }
  return true;
}

// Build the stub content. Not real chords, but a useful pointer.
export function buildSongsterrStub(
  title: string,
  artist: string,
  songsterrUrl: string
): string {
  return (
    `{title: ${title}}\n` +
    `{artist: ${artist}}\n\n` +
    `Tab available on Songsterr (Guitar Pro format with playback):\n` +
    `${songsterrUrl}\n\n` +
    `Open the link above to view and play the full tab.\n`
  );
}

async function fetchFn(
  artist: string,
  title: string
): Promise<ExternalChords | null> {
  const results = await searchSongsterr(artist, title);
  if (!results || results.length === 0) return null;

  const match = results.find(r =>
    validateSongsterrResult(r.title, r.artist, title, artist)
  );
  if (!match) {
    logger.info(
      { provider: SONGSTERR_ID, artist, title, topResult: results[0] },
      "songsterr no valid match"
    );
    return null;
  }

  const songsterrUrl = `https://www.songsterr.com/a/wa/song?id=${match.songId}`;
  const content = buildSongsterrStub(match.title, match.artist, songsterrUrl);

  return {
    source: SONGSTERR_ID,
    sourceName: SONGSTERR_NAME,
    sourceUrl: songsterrUrl,
    content,
    title: match.title,
    artist: match.artist,
  };
}

export const SongsterrProvider: ChordProvider = {
  id: SONGSTERR_ID,
  name: SONGSTERR_NAME,
  fetch: fetchFn,
};
