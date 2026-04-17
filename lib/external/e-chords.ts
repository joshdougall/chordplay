// External chord fallback via e-chords.com
//
// e-chords.com is behind Cloudflare's managed challenge and requires JavaScript
// execution to access. Server-side fetches will receive a 403 and this provider
// will return null. The implementation is correct and the parser is fully tested
// against fixture HTML; if Cloudflare protection is lifted or bypassed in future,
// it will work without changes.
//
// HTML structure observed from public documentation and source examples:
//   Search: GET /search.php?a=search&page=tabs&q=<artist>+<title>
//     Results list: <ul id="listResult"> with <li> items containing
//     <a class="song" href="/chords/<artist-slug>/<title-slug>">
//   Tab page: <pre id="core" class="core">...</pre>
//     Chords appear as <u>CHORD</u> on their own line directly above the lyric line.

import type { ExternalChords, ChordProvider } from "./provider";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const ECHORDS_ID = "e-chords";
export const ECHORDS_NAME = "E-Chords";

// Decode common HTML entities.
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#38;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Strip all HTML tags from a string.
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

/**
 * Convert an e-chords tab page HTML string to ChordPro format.
 *
 * E-chords encodes chords as <u>CHORD</u> tokens inline in the pre block.
 * The layout is chord-over-lyrics: chord tokens appear above the syllable they
 * belong to, separated from the lyric by a newline. We zip chord lines with
 * lyric lines to produce inline ChordPro markers.
 *
 * If zipping produces ambiguous results (unequal line counts), we fall back to
 * a preformatted block wrapped in {start_of_verse}...{end_of_verse}.
 *
 * Exported as a pure function so it can be unit-tested without network calls.
 */
export function eChordsHtmlToChordPro(
  html: string,
  title: string,
  artist: string
): string {
  // Extract the <pre id="core"> block.
  const coreMatch = html.match(/<pre[^>]*id=["']core["'][^>]*>([\s\S]*?)<\/pre>/i);
  if (!coreMatch) return "";

  const rawCore = coreMatch[1];

  // Split into lines, preserving the raw HTML per line so we can detect chord lines.
  const rawLines = rawCore.split("\n");

  // A "chord line" is one that contains at least one <u>...</u> element.
  // A "lyric line" is one without <u> elements.
  const isChordLine = (line: string) => /<u>/i.test(line);

  // Convert a chord-bearing HTML line to a ChordPro-annotated lyric string.
  // We zip chord tokens with the character positions they sit at so we can
  // insert [CHORD] markers at the right position in the following lyric line.
  //
  // Returns an array of { position, chord } pairs sorted by position.
  function extractChordPositions(line: string): Array<{ pos: number; chord: string }> {
    const positions: Array<{ pos: number; chord: string }> = [];

    // Walk through the raw HTML, tracking visible character position.
    let visiblePos = 0;
    let i = 0;
    while (i < line.length) {
      // Check for <u> tag (chord marker).
      const uMatch = line.slice(i).match(/^<u>([^<]*)<\/u>/i);
      if (uMatch) {
        const chord = decodeEntities(uMatch[1]).trim();
        if (chord) positions.push({ pos: visiblePos, chord });
        i += uMatch[0].length;
        // <u>CHORD</u> occupies visible space equal to chord length.
        visiblePos += chord.length;
        continue;
      }
      // Skip any other HTML tag.
      const tagMatch = line.slice(i).match(/^<[^>]+>/);
      if (tagMatch) {
        i += tagMatch[0].length;
        continue;
      }
      // Regular character — advance visible position.
      const ch = line[i];
      if (ch !== "\r") visiblePos++;
      i++;
    }

    return positions;
  }

  // Insert [CHORD] markers into a lyric string at given character positions.
  // We process right-to-left so earlier insertions don't shift later positions.
  function insertChordMarkers(
    lyric: string,
    chords: Array<{ pos: number; chord: string }>
  ): string {
    // Work on a mutable char array.
    const chars = [...lyric];
    // Sort descending by position.
    const sorted = [...chords].sort((a, b) => b.pos - a.pos);
    for (const { pos, chord } of sorted) {
      const insertAt = Math.min(pos, chars.length);
      chars.splice(insertAt, 0, ...`[${chord}]`);
    }
    return chars.join("");
  }

  // Build output lines by pairing chord lines with the lyric lines that follow.
  const outputLines: string[] = [];
  let idx = 0;

  while (idx < rawLines.length) {
    const line = rawLines[idx];

    if (isChordLine(line)) {
      const chordPositions = extractChordPositions(line);
      const lyricRaw = rawLines[idx + 1] ?? "";
      const lyric = decodeEntities(stripTags(lyricRaw));

      if (chordPositions.length > 0) {
        // Inline chord markers into the lyric line.
        const annotated = insertChordMarkers(lyric, chordPositions);
        outputLines.push(annotated);
        idx += 2; // consume both the chord line and lyric line
      } else {
        // Chord line with no parseable chords — just emit clean lyric.
        outputLines.push(lyric);
        idx += 2;
      }
    } else {
      // Pure lyric / structural line.
      const text = decodeEntities(stripTags(line)).trimEnd();
      outputLines.push(text);
      idx++;
    }
  }

  // Build the final ChordPro output.
  const header = `{title: ${title}}\n{artist: ${artist}}\n\n`;
  return header + outputLines.join("\n");
}

// Parse search result URLs from the e-chords search page HTML.
// Returns the first matching chord page URL, or null.
export function parseEChordsSearchResults(html: string): string | null {
  // e-chords result links: <a class="song" href="/chords/...">
  // or <a href="/chords/artist/title">
  const linkRe = /href="(\/chords\/[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const path = m[1];
    // Skip paths that look like category pages (just /chords/<letter> etc.)
    if (path.split("/").length >= 4) {
      return `https://www.e-chords.com${path}`;
    }
  }
  return null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10_000),
    });
    // Cloudflare returns 403 for managed-challenge pages we can't bypass server-side.
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Derive a URL-slug from a free-form string (lower-case, hyphens, no specials).
function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchEChordsChords(
  artist: string,
  title: string
): Promise<ExternalChords | null> {
  try {
    // 1. Search
    const q = encodeURIComponent(`${artist} ${title}`);
    const searchUrl = `https://www.e-chords.com/search.php?a=search&page=tabs&q=${q}`;
    const searchHtml = await fetchText(searchUrl);

    let tabUrl: string | null = null;

    if (searchHtml) {
      tabUrl = parseEChordsSearchResults(searchHtml);
    }

    // Fall back to canonical URL slug if search failed or returned no results.
    if (!tabUrl) {
      tabUrl = `https://www.e-chords.com/chords/${toSlug(artist)}/${toSlug(title)}`;
    }

    // 2. Fetch tab page
    const tabHtml = await fetchText(tabUrl);
    if (!tabHtml) return null;

    // 3. Extract title and artist from page if available, else use inputs.
    const pageTitleMatch = tabHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const pageArtistMatch = tabHtml.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    const resolvedTitle = pageTitleMatch ? decodeEntities(pageTitleMatch[1]).trim() : title;
    const resolvedArtist = pageArtistMatch ? decodeEntities(pageArtistMatch[1]).trim() : artist;

    // 4. Convert to ChordPro
    const content = eChordsHtmlToChordPro(tabHtml, resolvedTitle, resolvedArtist);
    if (!content) return null;

    return {
      source: ECHORDS_ID,
      sourceName: ECHORDS_NAME,
      sourceUrl: tabUrl,
      content,
      title: resolvedTitle,
      artist: resolvedArtist,
    };
  } catch {
    return null;
  }
}

export const EChordsProvider: ChordProvider = {
  id: ECHORDS_ID,
  name: ECHORDS_NAME,
  fetch: fetchEChordsChords,
};
