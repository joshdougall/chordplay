/**
 * Chord diagram database for svguitar.
 *
 * String numbering: 1 = high E, 6 = low E (standard guitar tab convention).
 * Fret values: positive integer = fret number, 0 = open string, "x" = muted.
 * Barre: fromString/toString are 1-indexed (1 = high E, 6 = low E).
 */

import type { Chord } from "svguitar";

export type ChordEntry = Chord;

export const CHORD_DB: Record<string, ChordEntry> = {
  // --- Major open chords ---
  C: {
    fingers: [
      [6, "x"],
      [5, 3],
      [4, 2],
      [3, 0],
      [2, 1],
      [1, 0],
    ],
    barres: [],
  },
  D: {
    fingers: [
      [6, "x"],
      [5, "x"],
      [4, 0],
      [3, 2],
      [2, 3],
      [1, 2],
    ],
    barres: [],
  },
  E: {
    fingers: [
      [6, 0],
      [5, 2],
      [4, 2],
      [3, 1],
      [2, 0],
      [1, 0],
    ],
    barres: [],
  },
  F: {
    fingers: [
      [5, 3],
      [4, 3],
      [3, 2],
    ],
    barres: [{ fromString: 6, toString: 1, fret: 1 }],
  },
  G: {
    fingers: [
      [6, 3],
      [5, 2],
      [4, 0],
      [3, 0],
      [2, 0],
      [1, 3],
    ],
    barres: [],
  },
  A: {
    fingers: [
      [6, "x"],
      [5, 0],
      [4, 2],
      [3, 2],
      [2, 2],
      [1, 0],
    ],
    barres: [],
  },
  B: {
    fingers: [
      [6, "x"],
      [4, 4],
      [3, 4],
      [2, 4],
    ],
    barres: [{ fromString: 5, toString: 1, fret: 2 }],
  },

  // --- Minor chords ---
  Cm: {
    fingers: [
      [5, 3],
      [4, 5],
      [3, 5],
    ],
    barres: [{ fromString: 6, toString: 1, fret: 3 }],
    position: 3,
  },
  Dm: {
    fingers: [
      [6, "x"],
      [5, "x"],
      [4, 0],
      [3, 2],
      [2, 3],
      [1, 1],
    ],
    barres: [],
  },
  Em: {
    fingers: [
      [6, 0],
      [5, 2],
      [4, 2],
      [3, 0],
      [2, 0],
      [1, 0],
    ],
    barres: [],
  },
  Fm: {
    fingers: [
      [5, 3],
      [4, 3],
    ],
    barres: [{ fromString: 6, toString: 1, fret: 1 }],
  },
  Gm: {
    fingers: [
      [5, 5],
      [4, 5],
    ],
    barres: [{ fromString: 6, toString: 1, fret: 3 }],
    position: 3,
  },
  Am: {
    fingers: [
      [6, "x"],
      [5, 0],
      [4, 2],
      [3, 2],
      [2, 1],
      [1, 0],
    ],
    barres: [],
  },
  Bm: {
    fingers: [
      [4, 4],
      [3, 4],
      [2, 3],
    ],
    barres: [{ fromString: 5, toString: 1, fret: 2 }],
  },

  // --- Dominant 7ths ---
  C7: {
    fingers: [
      [6, "x"],
      [5, 3],
      [4, 2],
      [3, 3],
      [2, 1],
      [1, 0],
    ],
    barres: [],
  },
  D7: {
    fingers: [
      [6, "x"],
      [5, "x"],
      [4, 0],
      [3, 2],
      [2, 1],
      [1, 2],
    ],
    barres: [],
  },
  E7: {
    fingers: [
      [6, 0],
      [5, 2],
      [4, 0],
      [3, 1],
      [2, 0],
      [1, 0],
    ],
    barres: [],
  },
  G7: {
    fingers: [
      [6, 3],
      [5, 2],
      [4, 0],
      [3, 0],
      [2, 0],
      [1, 1],
    ],
    barres: [],
  },
  A7: {
    fingers: [
      [6, "x"],
      [5, 0],
      [4, 2],
      [3, 0],
      [2, 2],
      [1, 0],
    ],
    barres: [],
  },
  B7: {
    fingers: [
      [6, "x"],
      [5, 2],
      [4, 1],
      [3, 2],
      [2, 0],
      [1, 2],
    ],
    barres: [],
  },

  // --- Minor 7ths ---
  Am7: {
    fingers: [
      [6, "x"],
      [5, 0],
      [4, 2],
      [3, 0],
      [2, 1],
      [1, 0],
    ],
    barres: [],
  },
  Em7: {
    fingers: [
      [6, 0],
      [5, 2],
      [4, 0],
      [3, 0],
      [2, 0],
      [1, 0],
    ],
    barres: [],
  },
  Dm7: {
    fingers: [
      [6, "x"],
      [5, "x"],
      [4, 0],
      [3, 2],
      [2, 1],
      [1, 1],
    ],
    barres: [],
  },
  Bm7: {
    fingers: [
      [3, 4],
      [2, 3],
    ],
    barres: [{ fromString: 5, toString: 1, fret: 2 }],
  },

  // --- Major 7ths ---
  Cmaj7: {
    fingers: [
      [6, "x"],
      [5, 3],
      [4, 2],
      [3, 0],
      [2, 0],
      [1, 0],
    ],
    barres: [],
  },
  Dmaj7: {
    fingers: [
      [6, "x"],
      [5, "x"],
      [4, 0],
      [3, 2],
      [2, 2],
      [1, 2],
    ],
    barres: [],
  },
  Emaj7: {
    fingers: [
      [6, 0],
      [5, 2],
      [4, 1],
      [3, 1],
      [2, 0],
      [1, 0],
    ],
    barres: [],
  },
  Fmaj7: {
    fingers: [
      [6, "x"],
      [5, "x"],
      [4, 3],
      [3, 2],
      [2, 1],
      [1, 0],
    ],
    barres: [],
  },
  Gmaj7: {
    fingers: [
      [6, 3],
      [5, 2],
      [4, 0],
      [3, 0],
      [2, 0],
      [1, 2],
    ],
    barres: [],
  },
  Amaj7: {
    fingers: [
      [6, "x"],
      [5, 0],
      [4, 2],
      [3, 1],
      [2, 2],
      [1, 0],
    ],
    barres: [],
  },

  // --- Sus chords ---
  Csus2: {
    fingers: [
      [6, "x"],
      [5, 3],
      [4, 0],
      [3, 0],
      [2, 1],
      [1, 3],
    ],
    barres: [],
  },
  Dsus2: {
    fingers: [
      [6, "x"],
      [5, "x"],
      [4, 0],
      [3, 2],
      [2, 3],
      [1, 0],
    ],
    barres: [],
  },
  Dsus4: {
    fingers: [
      [6, "x"],
      [5, "x"],
      [4, 0],
      [3, 2],
      [2, 3],
      [1, 3],
    ],
    barres: [],
  },
  Esus4: {
    fingers: [
      [6, 0],
      [5, 2],
      [4, 2],
      [3, 2],
      [2, 0],
      [1, 0],
    ],
    barres: [],
  },
  Asus2: {
    fingers: [
      [6, "x"],
      [5, 0],
      [4, 2],
      [3, 2],
      [2, 0],
      [1, 0],
    ],
    barres: [],
  },
  Asus4: {
    fingers: [
      [6, "x"],
      [5, 0],
      [4, 2],
      [3, 2],
      [2, 3],
      [1, 0],
    ],
    barres: [],
  },
  Gsus4: {
    fingers: [
      [6, 3],
      [5, 3],
      [4, 0],
      [3, 0],
      [2, 1],
      [1, 3],
    ],
    barres: [],
  },
};

/**
 * Normalize a chord name to a key present in CHORD_DB.
 * Tries the exact name first, then strips less common extensions
 * to fall back to simpler chords (e.g. "Cmaj9" -> "Cmaj7" -> "C").
 * Returns null if no match found.
 */
export function normalizeChord(name: string): string | null {
  if (!name) return null;

  // Direct match
  if (CHORD_DB[name]) return name;

  // Try common extension fallbacks in order
  const fallbacks: Array<(n: string) => string | null> = [
    // "Cadd9" -> "C", "Dadd2" -> "D"
    n => n.replace(/add\d+$/, ""),
    // "Cm9" -> "Cm7" -> "Cm"
    n => n.replace(/9$/, "7"),
    // "Cmaj9" -> "Cmaj7"
    n => n.replace(/maj9$/, "maj7"),
    // "C9" -> "C7"
    n => n.replace(/(?<!maj)9$/, "7"),
    // "Cm7b5" -> "Cm7" -> "Cm"
    n => n.replace(/7b5$/, "7"),
    n => n.replace(/7b5$/, ""),
    // "Cdim" -> "Cm"
    n => n.replace(/dim7?$/, "m"),
    // "Caug" -> "C"
    n => n.replace(/aug$/, ""),
    // "Cmaj7" -> "C", "Cm7" -> "Cm"
    n => n.replace(/maj7$/, ""),
    n => n.replace(/m7$/, "m"),
    n => n.replace(/7$/, ""),
    // "Csus2" / "Csus4" -> "C"
    n => n.replace(/sus[24]?$/, ""),
    // "Cm" -> "C" (last resort: strip minor)
    n => n.replace(/m$/, ""),
  ];

  for (const transform of fallbacks) {
    const candidate = transform(name);
    if (candidate && candidate !== name && CHORD_DB[candidate]) {
      return candidate;
    }
    // Recurse once for multi-step fallbacks
    if (candidate && candidate !== name) {
      const deeper = normalizeChord(candidate);
      if (deeper) return deeper;
    }
  }

  return null;
}
