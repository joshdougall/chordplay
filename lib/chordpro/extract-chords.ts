import { ChordProParser } from "chordsheetjs";
import type { Song } from "chordsheetjs";

export function isChordName(s: string): boolean {
  // After the root note and optional accidental, the next character must be
  // end-of-string, a digit, or one of the known chord suffix starters.
  // This rejects English words that start with A–G (Chorus, Bridge, etc.)
  return /^[A-G][#b]?(?:$|[0-9m/+\-(°øΔ]|maj|add|aug|dim|sus)/.test(s);
}

/** D/C and D/B both map to the same D diagram — key used for deduplication. */
export function chordDedupKey(name: string): string {
  return name.replace(/\/[A-Ga-g][#b]?$/, "").trim();
}

/** Extract ordered unique chord names from a parsed Song, filtering section labels
 *  and deduplicating slash chords that resolve to the same base shape. */
export function extractUniqueChords(song: Song): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const line of song.lines) {
    for (const item of line.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chords: string = (item as any).chords ?? "";
      if (!chords || !isChordName(chords)) continue;
      const key = chordDedupKey(chords);
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(chords);
      }
    }
  }
  return ordered;
}

/** Parse a raw ChordPro string and return the unique chord list. */
export function extractChordsFromSource(source: string): string[] {
  const song = new ChordProParser().parse(source);
  return extractUniqueChords(song);
}
