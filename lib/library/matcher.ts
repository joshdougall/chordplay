import { LibraryIndex, LibraryEntry } from "./index";
import { normalizeKey, normalizeField, levenshteinRatio } from "./normalize";
import { logger } from "@/lib/logger";

export type MatchInput = { trackId: string; title: string; artists: string[] };
export type MatchPrefs = { trackOverrides?: Record<string, string> };
export type MatchResult = {
  match: LibraryEntry | null;
  allMatches?: LibraryEntry[];
  confidence: "exact" | "fuzzy" | null;
  score?: number;
};

const ARTIST_FLOOR = 0.80;
const TITLE_FLOOR = 0.80;
const FUZZY_THRESHOLD = 0.88;
const ARTIST_WEIGHT = 0.35;
const TITLE_WEIGHT = 0.65;

export function match(index: LibraryIndex, input: MatchInput, prefs: MatchPrefs): MatchResult {
  const overrideId = prefs.trackOverrides?.[input.trackId];
  if (overrideId) {
    const e = index.get(overrideId);
    if (e) return { match: e, confidence: "exact" };
  }
  const byId = index.lookupByTrackId(input.trackId);
  if (byId) {
    const allByKey = index.lookupAllByKey(byId.songKey);
    return {
      match: byId, confidence: "exact",
      allMatches: allByKey.length > 1 ? allByKey : undefined,
    };
  }

  const artist = input.artists.join(", ");
  const wantedKey = normalizeKey(artist, input.title);
  const byKey = index.lookupByKey(wantedKey);
  if (byKey.length > 0) {
    const allByKey = index.lookupAllByKey(wantedKey);
    return {
      match: byKey[0], confidence: "exact",
      allMatches: allByKey.length > 1 ? allByKey : undefined,
    };
  }

  const wantedArtist = normalizeField(artist);
  const wantedTitle = normalizeField(input.title);
  let best: { entry: LibraryEntry; score: number } | null = null;
  for (const entry of index.all()) {
    if (entry.parseError) continue;
    const artistScore = levenshteinRatio(wantedArtist, normalizeField(entry.artist));
    if (artistScore < ARTIST_FLOOR) continue;
    const titleScore = levenshteinRatio(wantedTitle, normalizeField(entry.title));
    if (titleScore < TITLE_FLOOR) continue;
    const combined = ARTIST_WEIGHT * artistScore + TITLE_WEIGHT * titleScore;
    if (combined >= FUZZY_THRESHOLD && (!best || combined > best.score)) {
      best = { entry, score: combined };
    }
  }
  if (best) {
    const allByKey = index.lookupAllByKey(best.entry.songKey);
    logger.info({
      trackId: input.trackId,
      confidence: "fuzzy",
      score: best.score,
      matchId: best.entry.id
    }, "library matcher fuzzy match");
    return {
      match: best.entry, confidence: "fuzzy", score: best.score,
      allMatches: allByKey.length > 1 ? allByKey : undefined,
    };
  }
  logger.info({ trackId: input.trackId, confidence: null }, "library matcher no match");
  return { match: null, confidence: null };
}
