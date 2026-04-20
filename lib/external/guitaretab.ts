// External chord provider: guitaretab.com
// Classic plain-HTML chord/tab site. No working search endpoint.
// We navigate via the artist listing page (/<letter>/<artist-slug>/) and
// pick the first "chords" result for the requested song.

import type { ChordProvider, ExternalChords } from "./provider";
import { logger } from "@/lib/logger";
import { validateResult } from "./validate";

export const GUITARETAB_ID = "guitaretab";
export const GUITARETAB_NAME = "GuitareTab";

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
        { provider: GUITARETAB_ID, url, status: res.status },
        "guitaretab plain fetch bad status"
      );
      return null;
    }
    return await res.text();
  } catch (err) {
    logger.warn(
      { provider: GUITARETAB_ID, url, err: (err as Error).message },
      "guitaretab plain fetch error"
    );
    return null;
  }
}

/**
 * Convert an artist or song name to a guitaretab URL slug:
 * lowercase, spaces become hyphens, non-alphanumeric-hyphen stripped.
 * "Morgan Wallen" -> "morgan-wallen"
 */
export function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Extract title and artist from guitaretab og:title. */
export function parseGuitareTabMeta(
  html: string
): { title: string; artist: string } | null {
  const og = html.match(/<meta property="og:title" content="([^"]+)"/i);
  if (!og) return null;
  // "Creep chords with lyrics by Radiohead for guitar and ukulele @ Guitaretab"
  const raw = og[1];
  const byMatch = raw.match(/^(.+?)\s+chords?\s+with\s+lyrics\s+by\s+(.+?)\s+for\s/i);
  if (!byMatch) return null;
  return {
    title: byMatch[1].trim(),
    artist: byMatch[2].trim(),
  };
}

/**
 * Guitaretab encodes chord content inside a <pre> using a mixture of plain
 * js-tab-row <span>s and js-text-tab <div>s. Each js-text-tab div holds
 * a chord row (with gt-chord class spans) and a lyric row.
 *
 * We convert this to ChordPro inline [Chord]lyric format by:
 * 1. For each js-text-tab div: extract the chord name (from gt-chord span) and
 *    the lyric (from the second js-tab-row span), build a [Chord]lyric line.
 * 2. For plain js-tab-row spans (section headers, empty lines, etc.): include as-is.
 *
 * The key challenge: js-tab-row spans contain nested gt-chord spans, so a simple
 * non-greedy regex stops at the wrong </span>. We use a depth-counting approach
 * to extract the true content of each outermost js-tab-row span.
 */
export function parseGuitareTabContent(html: string): string | null {
  // Extract the <pre> block
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (!preMatch) return null;
  const preContent = preMatch[1];

  const lines: string[] = [];

  // Walk through the preContent, handling text-tab divs and plain rows in order.
  const nodeRe =
    /(<div class="js-text-tab"[\s\S]*?<\/div>|<span class="js-tab-row[^"]*"[^>]*>[\s\S]*?<\/span>)/g;
  let nm: RegExpExecArray | null;

  while ((nm = nodeRe.exec(preContent)) !== null) {
    const chunk = nm[1];

    if (chunk.startsWith('<div class="js-text-tab"')) {
      // Parse chord+lyric pair.
      // Structure: <div><chordRow><lyricRow></div>
      // chordRow: <span class="js-tab-row">...<span class="gt-chord">G</span></span>
      // lyricRow: <span class="js-tab-row">When you were here before,</span>
      //
      // Extract chord name from gt-chord span.
      const chordMatch = chunk.match(
        /<span class="gt-chord[^"]*"[^>]*>([^<]+)<\/span>/
      );
      const chordName = chordMatch ? chordMatch[1].trim() : "";

      // Extract lyric from the content of the outermost js-tab-row spans using
      // depth-aware span extraction. The last such span is the lyric row.
      const rowContents = extractJsTabRowContents(chunk);
      // rowContents[0] = chord row (contains gt-chord span markup)
      // rowContents[1] = lyric row (plain text)
      if (rowContents.length >= 2) {
        const lyric = stripTags(rowContents[1]).trim();
        if (chordName) {
          lines.push(`[${chordName}]${lyric}`);
        } else {
          lines.push(lyric);
        }
      } else if (rowContents.length === 1) {
        lines.push(stripTags(rowContents[0]).trim());
      }
    } else {
      // Plain js-tab-row span — extract its content with depth-aware extraction.
      const rowContents = extractJsTabRowContents(chunk);
      const raw = rowContents.length > 0 ? stripTags(rowContents[0]) : "";
      // Skip the PLEASE NOTE header block
      if (raw.includes("PLEASE NOTE") || raw.includes("author's own work")) {
        continue;
      }
      lines.push(raw);
    }
  }

  if (lines.length === 0) return null;

  // Clean up HTML entities
  const content = lines
    .map((l) =>
      l
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    )
    .join("\n");

  return content.trim() || null;
}

/**
 * Extract the content of each outermost js-tab-row span in the given HTML,
 * using a depth-counting approach to correctly handle nested <span> elements.
 */
function extractJsTabRowContents(html: string): string[] {
  const result: string[] = [];
  const startRe = /<span class="js-tab-row[^"]*"[^>]*>/g;
  let sm: RegExpExecArray | null;

  while ((sm = startRe.exec(html)) !== null) {
    const afterOpen = sm.index + sm[0].length;
    let depth = 1;
    let pos = afterOpen;

    while (pos < html.length && depth > 0) {
      const openIdx = html.indexOf("<span", pos);
      const closeIdx = html.indexOf("</span>", pos);
      if (closeIdx === -1) break;
      if (openIdx !== -1 && openIdx < closeIdx) {
        depth++;
        pos = openIdx + 5;
      } else {
        depth--;
        if (depth === 0) {
          result.push(html.slice(afterOpen, closeIdx));
          // Advance startRe past this span's closing tag
          startRe.lastIndex = closeIdx + 7;
          break;
        }
        pos = closeIdx + 7;
      }
    }
  }

  return result;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

type SongResult = {
  href: string; // e.g. /r/radiohead/288870.html
  titleAttr: string; // e.g. "Creep chords"
};

/**
 * Scan the artist page HTML for song links matching the target title.
 * Prefers "chords" entries over "tab" entries.
 */
export function findSongHref(
  html: string,
  targetTitle: string
): string | null {
  const targetLower = targetTitle.toLowerCase().trim();

  // Links: <a href="/r/radiohead/288870.html" class="gt-link gt-link--primary" title="Creep chords">
  const linkRe =
    /href="(\/[a-z]\/[^/]+\/\d+\.html)"\s+class="gt-link[^"]*"\s+title="([^"]+)"/g;
  const results: SongResult[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    results.push({ href: m[1], titleAttr: m[2] });
  }

  // Also try alternate URL pattern: /artist-slug_song-slug_id.html
  const altRe =
    /href="(\/[^"]+_\d+\.html)"\s+class="gt-link[^"]*"\s+title="([^"]+)"/g;
  while ((m = altRe.exec(html)) !== null) {
    results.push({ href: m[1], titleAttr: m[2] });
  }

  if (results.length === 0) return null;

  // Score each result: prefer "chords" type, prefer title match
  const norm = (s: string) => s.toLowerCase().replace(/\s+chords?.*$/, "").trim();
  let best: { href: string; score: number } | null = null;

  for (const r of results) {
    const rTitle = norm(r.titleAttr);
    if (rTitle !== targetLower) continue;
    const isChords = /chords?/i.test(r.titleAttr);
    const score = isChords ? 2 : 1;
    if (!best || score > best.score) {
      best = { href: r.href, score };
    }
  }

  if (best) return best.href;

  // Fuzzy fallback: partial title match
  for (const r of results) {
    const rTitle = norm(r.titleAttr);
    if (rTitle.includes(targetLower) || targetLower.includes(rTitle)) {
      return r.href;
    }
  }

  return null;
}

async function fetchFn(
  artist: string,
  title: string
): Promise<ExternalChords | null> {
  try {
    const aSlug = toSlug(artist);
    if (!aSlug) return null;
    const letter = aSlug[0];

    // 1. Fetch artist listing page
    const artistUrl = `https://www.guitaretab.com/${letter}/${aSlug}/`;
    const artistHtml = await plainFetch(artistUrl);
    if (!artistHtml) {
      logger.info(
        {
          provider: GUITARETAB_ID,
          artist,
          title,
          reason: "artist-page-not-found",
        },
        "guitaretab artist page not found"
      );
      return null;
    }

    // 2. Find the song link
    const songHref = findSongHref(artistHtml, title);
    if (!songHref) {
      logger.info(
        {
          provider: GUITARETAB_ID,
          artist,
          title,
          reason: "song-not-found",
        },
        "guitaretab song not found"
      );
      return null;
    }

    // 3. Fetch song page
    const songUrl = `https://www.guitaretab.com${songHref}`;
    const songHtml = await plainFetch(songUrl);
    if (!songHtml) return null;

    // 4. Extract metadata and validate
    const meta = parseGuitareTabMeta(songHtml);
    if (!meta) {
      logger.info(
        { provider: GUITARETAB_ID, artist, title, reason: "no-metadata" },
        "guitaretab no metadata"
      );
      return null;
    }

    if (!validateResult({ artist, title }, meta, GUITARETAB_ID)) return null;

    // 5. Extract chord content
    const content = parseGuitareTabContent(songHtml);
    if (!content) return null;

    return {
      source: GUITARETAB_ID,
      sourceName: GUITARETAB_NAME,
      sourceUrl: songUrl,
      content,
      title: meta.title,
      artist: meta.artist,
    };
  } catch (err) {
    logger.warn(
      { provider: GUITARETAB_ID, artist, title, err: (err as Error).message },
      "guitaretab fetch error"
    );
    return null;
  }
}

export const GuitareTabProvider: ChordProvider = {
  id: GUITARETAB_ID,
  name: GUITARETAB_NAME,
  fetch: fetchFn,
};
