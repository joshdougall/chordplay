export function normalizeChordRoot(chord: string): string | null {
  // "Cmaj7/E" -> "C"; "F#m" -> "F#"; "Bbsus4" -> "Bb"
  const m = chord.match(/^([A-G][#b]?)/);
  return m ? m[1] : null;
}

/**
 * Detects the most likely key from a list of chord names.
 * Heuristic: the first chord is often the key. If it ranks in the top 2 by
 * frequency, use it. Otherwise fall back to the most frequent root.
 */
export function detectKey(chordNames: string[]): string | null {
  if (chordNames.length === 0) return null;
  const counts = new Map<string, number>();
  for (const c of chordNames) {
    const root = normalizeChordRoot(c);
    if (root) counts.set(root, (counts.get(root) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const first = normalizeChordRoot(chordNames[0]);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (first && sorted.slice(0, 2).some(([c]) => c === first)) return first;
  return sorted[0]?.[0] ?? null;
}

const CHROMATIC_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * When a song is transposed up by `semitones`, suggests a capo position so the
 * player can use the original open-chord shapes.
 *
 * Returns null when semitones <= 0 (transposing down doesn't map cleanly to a
 * capo) or when the displayed key can't be resolved.
 */
export function capoSuggestion(
  displayedKey: string,
  semitones: number
): { capoFret: number; shapeKey: string } | null {
  if (semitones <= 0) return null;
  const idx = CHROMATIC_KEYS.indexOf(normalizeChordRoot(displayedKey) ?? "");
  if (idx < 0) return null;
  const shapeIdx = (idx - semitones + 12) % 12;
  return { capoFret: semitones, shapeKey: CHROMATIC_KEYS[shapeIdx] };
}
