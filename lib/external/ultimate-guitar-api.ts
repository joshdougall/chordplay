// External chord provider via Ultimate Guitar unofficial mobile API
// Endpoint base: https://api.ultimate-guitar.com/api/v1
//
// Auth: No user login needed. Requests are signed with a per-session device ID
// and an X-UG-API-KEY derived as:
//   MD5( deviceId + "YYYY-MM-DD:H" (UTC) + "createLog()" )
//
// Discovered by reverse-engineering the UG Android app:
//   https://github.com/Pilfer/ultimate-guitar-scraper
//
// Tab type 300 = Chords. Search returns JSON with a `tabs` array;
// tab/info returns full content in UG's [ch]CHORD[/ch] / [tab]…[/tab] format.

import { createHash } from "crypto";
import type { ChordProvider, ExternalChords } from "./provider";
import { logger } from "@/lib/logger";
import { cleanTitleForSearch, cleanArtistForSearch } from "./clean-title";
import { validateResult } from "./validate";

export const UG_API_ID = "ultimate-guitar-api";
export const UG_API_NAME = "Ultimate Guitar";

const UG_API_BASE = "https://api.ultimate-guitar.com/api/v1";
const UG_USER_AGENT = "UGT_ANDROID/4.11.1 (Pixel; 8.1.0)";

// Tab type 300 = Chords
const UG_TYPE_CHORDS = 300;

// --- Key generation -----------------------------------------------------------

function randomHex(bytes: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < bytes * 2; i++) {
    out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

// The API key is regenerated each request so each call is independently valid.
function generateAPIKey(deviceId: string): string {
  const now = new Date();
  // UTC date components
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = now.getUTCHours();
  const input = `${deviceId}${y}-${m}-${d}:${h}createLog()`;
  return createHash("md5").update(input).digest("hex");
}

function makeHeaders(): Record<string, string> {
  const deviceId = randomHex(8); // 16-char hex = 8 random bytes
  return {
    "User-Agent": UG_USER_AGENT,
    "X-UG-CLIENT-ID": deviceId,
    "X-UG-API-KEY": generateAPIKey(deviceId),
    Accept: "application/json",
    "Accept-Charset": "utf-8",
  };
}

// --- Content conversion -------------------------------------------------------

// Convert UG tab format to ChordPro:
//   [ch]C[/ch]   →  [C]
//   [tab]…[/tab] → stripped
//   [Verse 1]    → kept as-is (section markers look ChordPro-ish)
export function ugContentToChordPro(content: string): string {
  return content
    .replace(/\[ch\]([^\[]+)\[\/ch\]/g, "[$1]")
    .replace(/\[\/?tab\]/g, "")
    .trim();
}

// --- Response shapes (minimal) ------------------------------------------------

interface UGTab {
  id: number;
  song_name: string;
  artist_name: string;
  type: string;
  rating: number;
  url?: string;
  tab_url?: string;
}

interface UGSearchResponse {
  tabs?: UGTab[];
}

interface UGTabInfoResponse {
  id?: number;
  song_name?: string;
  artist_name?: string;
  type?: string;
  rating?: number;
  content?: string;
  url_web?: string;
}

// --- API calls ----------------------------------------------------------------

export async function searchTabs(
  artist: string,
  title: string
): Promise<UGTab[]> {
  const query = `${artist} ${title}`;
  const url = `${UG_API_BASE}/tab/search?title=${encodeURIComponent(query)}&type[]=${UG_TYPE_CHORDS}&page=1`;

  const resp = await fetch(url, {
    headers: makeHeaders(),
    // next-specific cache: 0 so we always get a fresh call (disk cache is above us)
    cache: "no-store",
  });

  if (!resp.ok) {
    throw new Error(`UG search HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as UGSearchResponse;
  return (data.tabs ?? []).filter((t) => t.type === "Chords");
}

export async function getTab(tabId: number): Promise<UGTabInfoResponse> {
  const url = `${UG_API_BASE}/tab/info?tab_id=${tabId}&tab_access_type=public`;

  const resp = await fetch(url, {
    headers: makeHeaders(),
    cache: "no-store",
  });

  if (!resp.ok) {
    throw new Error(`UG tab/info HTTP ${resp.status}`);
  }

  return (await resp.json()) as UGTabInfoResponse;
}

// --- ChordProvider implementation --------------------------------------------

export async function fetchUGApiChords(
  artist: string,
  title: string
): Promise<ExternalChords | null> {
  const cleanTitle = cleanTitleForSearch(title);
  const cleanArtist = cleanArtistForSearch(artist);

  // First try as-is, fall back to cleaned query on any error (404 common for titles with " - Bonus Track" etc).
  const attempts: Array<{ a: string; t: string }> = [];
  attempts.push({ a: artist, t: title });
  if (cleanTitle !== title || cleanArtist !== artist) {
    attempts.push({ a: cleanArtist, t: cleanTitle });
  }

  let tabs: UGTab[] = [];
  for (const { a, t } of attempts) {
    try {
      tabs = await searchTabs(a, t);
      if (tabs.length > 0) break;
    } catch (err) {
      logger.warn({ err, artist: a, title: t }, "ug-api search failed, trying next variation");
    }
  }

  if (tabs.length === 0) {
    return null;
  }

  // Sort by rating, then iterate until we find one that validates against the requested title+artist
  tabs.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  // Validate against the CLEAN versions so "(feat. X)" suffix differences don't punish good matches
  const requestedForValidation = { artist: cleanArtist, title: cleanTitle };

  const validTabs = tabs.filter(t =>
    validateResult(
      requestedForValidation,
      { artist: t.artist_name ?? "", title: t.song_name ?? "" },
      UG_API_ID
    )
  );

  if (validTabs.length === 0) {
    logger.info(
      { provider: UG_API_ID, artist, title, searchedCount: tabs.length, topResult: { artist: tabs[0]?.artist_name, title: tabs[0]?.song_name } },
      "ug-api: no search results validated against requested artist/title"
    );
    return null;
  }

  const best = validTabs[0];

  let tabInfo: UGTabInfoResponse;
  try {
    tabInfo = await getTab(best.id);
  } catch (err) {
    logger.warn({ err, tabId: best.id }, "ug-api tab/info failed");
    return null;
  }

  const rawContent = tabInfo.content;
  if (!rawContent || rawContent.trim().length === 0) {
    return null;
  }

  const chordPro = ugContentToChordPro(rawContent);
  if (!chordPro) return null;

  const resolvedTitle = tabInfo.song_name ?? best.song_name ?? title;
  const resolvedArtist = tabInfo.artist_name ?? best.artist_name ?? artist;
  const rating = tabInfo.rating ?? best.rating;
  const sourceUrl =
    tabInfo.url_web ??
    best.tab_url ??
    best.url ??
    `https://www.ultimate-guitar.com/tab/${best.id}`;

  return {
    source: UG_API_ID,
    sourceName: UG_API_NAME,
    sourceUrl,
    content: `{title: ${resolvedTitle}}\n{artist: ${resolvedArtist}}\n\n${chordPro}`,
    title: resolvedTitle,
    artist: resolvedArtist,
    rating,
  };
}

export const UltimateGuitarApiProvider: ChordProvider = {
  id: UG_API_ID,
  name: UG_API_NAME,
  fetch: fetchUGApiChords,
};
