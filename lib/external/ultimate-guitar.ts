// External chord provider via Ultimate Guitar (tabs.ultimate-guitar.com)
// Uses FlareSolverr (preferred) or Firecrawl (fallback) to bypass Cloudflare. Flow:
//   1. Scrape UG search page, parse js-store JSON for the first Chords result
//   2. Scrape the tab page, parse js-store JSON for wiki_tab.content
//   3. Convert [ch]CHORD[/ch] → [CHORD], strip [tab]/[/tab] markers

import { flaresolverrFetch } from "./flaresolverr";
import { firecrawlScrape } from "./firecrawl";
import type { ChordProvider, ExternalChords } from "./provider";

export const UG_ID = "ultimate-guitar";
export const UG_NAME = "Ultimate Guitar";

// Decode HTML entities in the data-content attribute value.
export function decodeDataContent(raw: string): string {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

// Convert UG wiki content to ChordPro:
//   [ch]C[/ch]  →  [C]
//   [tab] / [/tab] stripped
export function ugContentToChordPro(wiki: string): string {
  return wiki
    .replace(/\[ch\]([^\[]+)\[\/ch\]/g, "[$1]")
    .replace(/\[\/?tab\]/g, "")
    .trim();
}

type UgTabResult = {
  tab_url: string;
  artist_name?: string;
  song_name?: string;
  rating?: number;
};

// Parse the js-store data-content attribute from a UG page HTML.
// Returns the parsed object or null.
export function parseUgStore(html: string): unknown {
  const match = html.match(/data-content="([^"]+)"/);
  if (!match) return null;
  try {
    return JSON.parse(decodeDataContent(match[1]));
  } catch {
    return null;
  }
}

// Scrape a URL to HTML. Tries flaresolverr first (free, self-hosted),
// falls back to firecrawl if configured.
async function scrape(url: string, waitFor = 1500): Promise<string | null> {
  const fs = await flaresolverrFetch(url);
  if (fs) return fs;
  const fc = await firecrawlScrape({ url, formats: ["html"], waitFor });
  return fc?.html ?? null;
}

export async function fetchUltimateGuitarChords(
  artist: string,
  title: string
): Promise<ExternalChords | null> {
  const query = encodeURIComponent(`${artist} ${title}`);
  const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`;

  const searchHtml = await scrape(searchUrl);
  if (!searchHtml) return null;

  const searchData = parseUgStore(searchHtml);
  if (!searchData) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (searchData as any)?.store?.page?.data?.results ?? [];
  if (!Array.isArray(results) || results.length === 0) return null;

  // Filter to Chords type only, pick highest rated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chordResults: UgTabResult[] = results.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r?.type === "Chords" && r?.tab_url
  );
  if (chordResults.length === 0) return null;
  chordResults.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const picked = chordResults[0];

  // Scrape the tab page
  const tabHtml = await scrape(picked.tab_url);
  if (!tabHtml) return null;

  const tabData = parseUgStore(tabHtml);
  if (!tabData) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wiki = (tabData as any)?.store?.page?.data?.tab_view?.wiki_tab?.content;
  if (typeof wiki !== "string") return null;

  const chordPro = ugContentToChordPro(wiki);
  if (!chordPro) return null;

  const resolvedTitle = picked.song_name ?? title;
  const resolvedArtist = picked.artist_name ?? artist;

  return {
    source: UG_ID,
    sourceName: UG_NAME,
    sourceUrl: picked.tab_url,
    content: `{title: ${resolvedTitle}}\n{artist: ${resolvedArtist}}\n\n${chordPro}`,
    title: resolvedTitle,
    artist: resolvedArtist,
    rating: picked.rating,
  };
}

export const UltimateGuitarProvider: ChordProvider = {
  id: UG_ID,
  name: UG_NAME,
  fetch: fetchUltimateGuitarChords,
};
