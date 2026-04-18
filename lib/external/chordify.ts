// External chord provider via Chordify (chordify.net)
// Uses FlareSolverr (preferred) or Firecrawl (fallback) to bypass Cloudflare. Flow:
//   1. Scrape search page https://chordify.net/search/<query>
//   2. Extract first song link (/chords/...) from the response
//   3. Scrape the song page, extract chords from rendered content
//
// Chordify is JS-heavy; waitFor gives the app time to render.
// The result is best-effort — if no recognisable chord content is found, returns null.

import { flaresolverrFetch } from "./flaresolverr";
import { firecrawlScrape } from "./firecrawl";
import type { ChordProvider, ExternalChords } from "./provider";

export const CHORDIFY_ID = "chordify";
export const CHORDIFY_NAME = "Chordify";

// Convert a free-form string to a URL-safe slug.
export function toChordifySlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Parse the first /chords/... link from scrape output (markdown or HTML).
// Chordify links look like: /chords/some-artist-some-title-HASH
export function extractFirstChordifyLink(content: string): string | null {
  // Match markdown links: [text](/chords/...)
  const mdLinkRe = /\[([^\]]+)\]\((\/chords\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLinkRe.exec(content)) !== null) {
    const path = m[2];
    // The last path segment is the song slug — require it to be more than
    // 2 characters to skip single-letter category pages like /chords/c.
    const lastSegment = path.split("/").filter(Boolean).at(-1) ?? "";
    if (lastSegment.length > 2) {
      return `https://chordify.net${path}`;
    }
  }
  // Also try bare URL patterns — works for both markdown and raw HTML
  const bareLinkRe = /https:\/\/chordify\.net(\/chords\/[^\s)>\]"]+)/g;
  while ((m = bareLinkRe.exec(content)) !== null) {
    return `https://chordify.net${m[1]}`;
  }
  return null;
}

// Extract chord lines from the markdown scraped from a Chordify song page.
// Chordify renders chords in a repeating pattern where chord names appear
// as standalone tokens (capital letter optionally followed by chord suffix)
// separated by whitespace on dedicated lines.
//
// We look for the characteristic sections and build a simple ChordPro block.
export function extractChordifyContent(markdown: string, title: string, artist: string): string | null {
  // Chordify markdown typically has sections labeled like:
  //   ## Verse  or  ## Chorus
  // followed by lines of chord names, e.g.:
  //   G  D  Em  C
  //
  // We extract all chord-bearing lines and build a plain ChordPro sheet.
  // A "chord line" is a line where every non-empty token matches a chord pattern.
  const CHORD_TOKEN = /^[A-G][b#]?(m|maj|min|aug|dim|sus|add|M)?[0-9]*(\/[A-G][b#]?)?$/;

  const lines = markdown.split("\n");
  const outputLines: string[] = [];
  let foundContent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      outputLines.push("");
      continue;
    }

    // Section headers (## Verse, ## Chorus, etc.) → {comment: ...}
    const sectionMatch = trimmed.match(/^#+\s+(.+)$/);
    if (sectionMatch) {
      const label = sectionMatch[1].trim();
      // Skip page-level headings that are just the song/artist title
      if (
        label.toLowerCase().includes(title.toLowerCase()) ||
        label.toLowerCase().includes(artist.toLowerCase())
      ) {
        continue;
      }
      outputLines.push(`{comment: ${label}}`);
      continue;
    }

    // Check if every token on this line is a chord
    const tokens = trimmed.split(/\s+/);
    if (tokens.length > 0 && tokens.every(t => CHORD_TOKEN.test(t))) {
      // Chord-only line — render inline as [C] [G] etc.
      outputLines.push(tokens.map(t => `[${t}]`).join(" "));
      foundContent = true;
      continue;
    }

    // Otherwise treat as a lyric/structural line
    outputLines.push(trimmed);
  }

  if (!foundContent) return null;

  const header = `{title: ${title}}\n{artist: ${artist}}\n\n`;
  // Trim leading/trailing blank lines from body
  const body = outputLines.join("\n").trim();
  return header + body;
}

// Scrape a URL, trying flaresolverr first then firecrawl (markdown format).
// Returns HTML from flaresolverr, or markdown from firecrawl, or null.
async function scrape(
  url: string,
  waitFor = 3000
): Promise<{ content: string; isHtml: boolean } | null> {
  const fs = await flaresolverrFetch(url);
  if (fs) return { content: fs, isHtml: true };
  const fc = await firecrawlScrape({
    url,
    formats: ["markdown"],
    onlyMainContent: true,
    waitFor,
  });
  if (fc?.markdown) return { content: fc.markdown, isHtml: false };
  return null;
}

export async function fetchChordifyChords(
  artist: string,
  title: string
): Promise<ExternalChords | null> {
  // 1. Search
  const query = toChordifySlug(`${artist} ${title}`);
  const searchUrl = `https://chordify.net/search/${encodeURIComponent(query)}`;

  const searchResult = await scrape(searchUrl);
  if (!searchResult) return null;

  const songUrl = extractFirstChordifyLink(searchResult.content);
  if (!songUrl) return null;

  // 2. Scrape the song page
  // extractChordifyContent is markdown-based; if we got HTML from flaresolverr
  // on the search page, still attempt firecrawl for the song page markdown so
  // the chord extractor has the format it expects. Fall back to flaresolverr HTML
  // if firecrawl is unavailable.
  let songContent: string | null = null;
  const fc = await firecrawlScrape({
    url: songUrl,
    formats: ["markdown"],
    onlyMainContent: true,
    waitFor: 3000,
  });
  if (fc?.markdown) {
    songContent = fc.markdown;
  } else {
    songContent = await flaresolverrFetch(songUrl);
  }
  if (!songContent) return null;

  // 3. Extract title/artist from metadata if available, else use inputs
  // (metadata only available via firecrawl path)
  const resolvedTitle = fc?.metadata?.title
    ? fc.metadata.title.replace(/\s*[-|].*$/, "").trim() || title
    : title;
  const resolvedArtist = artist;

  // 4. Extract chord content
  const content = extractChordifyContent(songContent, resolvedTitle, resolvedArtist);
  if (!content) return null;

  return {
    source: CHORDIFY_ID,
    sourceName: CHORDIFY_NAME,
    sourceUrl: songUrl,
    content,
    title: resolvedTitle,
    artist: resolvedArtist,
  };
}

export const ChordifyProvider: ChordProvider = {
  id: CHORDIFY_ID,
  name: CHORDIFY_NAME,
  fetch: fetchChordifyChords,
};
