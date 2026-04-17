import { LibraryIndex, LibraryEntry } from "./index";
import { normalizeKey, levenshteinRatio } from "./normalize";

export type MatchInput = {
  trackId: string;
  title: string;
  artists: string[];
};

export type MatchPrefs = {
  trackOverrides?: Record<string, string>;
};

export type MatchResult = {
  match: LibraryEntry | null;
  confidence: "exact" | "fuzzy" | null;
};

const FUZZY_THRESHOLD = 0.85;

export function match(index: LibraryIndex, input: MatchInput, prefs: MatchPrefs): MatchResult {
  const overrideId = prefs.trackOverrides?.[input.trackId];
  if (overrideId) {
    const e = index.get(overrideId);
    if (e) return { match: e, confidence: "exact" };
  }

  const byId = index.lookupByTrackId(input.trackId);
  if (byId) return { match: byId, confidence: "exact" };

  const artist = input.artists.join(", ");
  const wantedKey = normalizeKey(artist, input.title);
  const byKey = index.lookupByKey(wantedKey);
  if (byKey.length > 0) return { match: byKey[0], confidence: "exact" };

  let best: { entry: LibraryEntry; ratio: number } | null = null;
  for (const key of index.keys()) {
    const r = levenshteinRatio(key, wantedKey);
    if (r >= FUZZY_THRESHOLD && (!best || r > best.ratio)) {
      const candidates = index.lookupByKey(key);
      if (candidates[0]) best = { entry: candidates[0], ratio: r };
    }
  }
  if (best) return { match: best.entry, confidence: "fuzzy" };
  return { match: null, confidence: null };
}
