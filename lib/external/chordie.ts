// External chord fallback via chordie.com
// chordie.com aggregates guitar tabs from multiple sources and is accessible
// without JS challenges. The chord pages return content already in a
// ChordPro-compatible inline format.

import type { ExternalChords, ChordProvider } from "./provider";
import { levenshteinRatio, normalizeField } from "@/lib/library/normalize";
import { logger } from "@/lib/logger";

// Minimum similarity ratio required for both title and artist when validating
// a fetched chordie page against the requested track.
const MATCH_THRESHOLD = 0.60;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const CHORDIE_ID = "chordie";
export const CHORDIE_NAME = "Chordie";

// Exported so it can be unit-tested in isolation.
export function chordieLineToChordPro(line: string): string {
  // chordie chordlines already contain inline chords as [G], [Am7], [D/F#] etc.
  // The content is already ChordPro-compatible; just return it.
  return line;
}

// Convert an array of {kind, text} lines to a single ChordPro string.
// chordlines have inline chords; textlines are pure lyrics.
export function buildChordPro(
  lines: Array<{ kind: "chord" | "text"; text: string }>,
  title: string,
  artist: string
): string {
  const header = `{title: ${title}}\n{artist: ${artist}}\n\n`;
  const body = lines
    .map(({ kind, text }) => {
      if (kind === "text") return text;
      return chordieLineToChordPro(text);
    })
    .join("\n");
  return header + body;
}

// Parse chordline/textline divs out of a chordie chord page HTML string.
// Exported for testing.
export function parseChordieTab(html: string): Array<{ kind: "chord" | "text"; text: string }> {
  const results: Array<{ kind: "chord" | "text"; text: string }> = [];

  // Match all chordline and textline divs. The regex is greedy-safe because
  // chordie wraps each line in its own div (no nesting).
  const divRe = /<div class="(chordline|textline)">([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = divRe.exec(html)) !== null) {
    const kind = m[1] === "chordline" ? "chord" : "text";
    let text = m[2];

    // The chords inside chordlines are wrapped in spans. The structure is:
    // <span class="bracket">[</span><span class="relc"><span class="absc G">G</span></span><span class="bracket">]</span>
    // We want to collapse that to [G].
    text = text.replace(
      /<span class="bracket">\[<\/span>\s*<span[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<\/span>\s*<span class="bracket">\]<\/span>/g,
      "[$1]"
    );

    // Strip any remaining HTML tags
    text = text.replace(/<[^>]+>/g, "");

    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#38;/g, "&")
      .replace(/&#39;/g, "'");

    // Trim leading/trailing whitespace but preserve internal spacing
    // (spacing is significant in chord-above-lyric contexts)
    text = text.trimEnd();

    results.push({ kind, text });
  }

  return results;
}

type SearchResult = {
  title: string;
  artist: string;
  url: string; // relative, e.g. /chord.pere/www.guitartabs.cc/...
};

function parseSearchResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Each result is wrapped in a div containing:
  //   <a href="/chord.pere/..."><span style="font-size: 18px...">Title</span>
  //   &nbsp;&nbsp;<span style="color: grey;font-size: 16px...">Artist</span></a>
  const blockSplit = html.split("position: relative;float: left");
  for (let i = 1; i < blockSplit.length; i++) {
    const block = blockSplit[i];
    const linkM = block.match(/href="(\/chord\.pere\/[^"]+)"/);
    const titleM = block.match(/font-size: 18px[^>]*>([^<]+)/);
    const artistM = block.match(/color: grey;font-size: 16px[^>]*>([^<]+)/);
    if (linkM && titleM) {
      results.push({
        url: linkM[1],
        title: titleM[1].trim(),
        artist: artistM ? artistM[1].trim() : "",
      });
    }
  }
  return results;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreTitleArtist(result: SearchResult, artist: string, title: string): number {
  // Title word overlap is required; artist is a tiebreaker.
  // Stop-words ("the", "a", "an") are excluded from the artist score to avoid
  // matching wrong songs solely because both are by "The Beatles".
  const STOP = new Set(["the", "a", "an", "of", "in", "on", "at"]);
  const normalize = (s: string) => slugify(s).split(" ").filter(Boolean);
  const wantTitle = normalize(title);
  const wantArtist = normalize(artist).filter(w => !STOP.has(w));
  const gotTitle = normalize(result.title);
  const gotArtist = normalize(result.artist);

  let titleScore = 0;
  for (const w of wantTitle) {
    if (gotTitle.includes(w)) titleScore += 2;
  }
  // Require at least one meaningful title word to match before counting artist.
  if (titleScore === 0) return 0;

  let artistScore = 0;
  for (const w of wantArtist) {
    if (gotArtist.includes(w)) artistScore += 3;
  }
  return titleScore + artistScore;
}

// Validate that the title and artist on the fetched page match the requested
// values closely enough to be considered the same song.
// Returns true if both ratios are >= MATCH_THRESHOLD, false otherwise.
export function validateChordieResult(
  gotTitle: string,
  gotArtist: string,
  wantTitle: string,
  wantArtist: string
): boolean {
  const titleRatio = levenshteinRatio(normalizeField(gotTitle), normalizeField(wantTitle));
  const artistRatio = levenshteinRatio(normalizeField(gotArtist), normalizeField(wantArtist));
  if (titleRatio < MATCH_THRESHOLD || artistRatio < MATCH_THRESHOLD) {
    logger.warn({
      artist: wantArtist,
      title: wantTitle,
      returnedArtist: gotArtist,
      returnedTitle: gotTitle,
      titleRatio,
      artistRatio,
      reason: "validator-reject"
    }, "chordie validator rejected result");
    return false;
  }
  return true;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // chordie pages may use latin-1; TextDecoder defaults to utf-8 but we
    // fall back to latin-1 if utf-8 parse looks broken.
    try {
      return new TextDecoder("utf-8").decode(buf);
    } catch {
      return new TextDecoder("latin1").decode(buf);
    }
  } catch {
    return null;
  }
}

export async function fetchChordieChords(
  artist: string,
  title: string
): Promise<ExternalChords | null> {
  try {
    // 1. Search
    const q = encodeURIComponent(`${artist} ${title}`);
    const searchUrl = `https://www.chordie.com/results.php?q=${q}&from=0&size=10&mode=song`;
    const searchHtml = await fetchText(searchUrl);
    if (!searchHtml) return null;

    // 2. Pick best result
    const results = parseSearchResults(searchHtml);
    if (results.length === 0) return null;

    let best = results[0];
    let bestScore = scoreTitleArtist(best, artist, title);
    for (const r of results.slice(1)) {
      const s = scoreTitleArtist(r, artist, title);
      if (s > bestScore) {
        bestScore = s;
        best = r;
      }
    }
    // Require at least some match (title word hit)
    if (bestScore < 2) return null;

    // 3. Fetch the tab page
    const tabUrl = `https://www.chordie.com${best.url}`;
    const tabHtml = await fetchText(tabUrl);
    if (!tabHtml) return null;

    // 4. Parse and convert
    const lines = parseChordieTab(tabHtml);
    if (lines.length === 0) return null;

    // 5. Validate the returned title/artist against what was requested
    if (!validateChordieResult(best.title, best.artist, title, artist)) {
      return null;
    }

    const content = buildChordPro(lines, best.title, best.artist);
    return {
      source: CHORDIE_ID,
      sourceName: CHORDIE_NAME,
      sourceUrl: tabUrl,
      content,
      title: best.title,
      artist: best.artist,
    };
  } catch {
    return null;
  }
}

export const ChordieProvider: ChordProvider = {
  id: CHORDIE_ID,
  name: CHORDIE_NAME,
  fetch: fetchChordieChords,
};
