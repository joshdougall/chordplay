/**
 * Chord lookup layer — curated DB first, then @tombatossals/chords-db fallback.
 *
 * String numbering (svguitar convention): 1 = high E, 6 = low E.
 * @tombatossals/chords-db frets array: index 0 = low E (string 6), index 5 = high E (string 1).
 */

import { CHORD_DB, normalizeChord } from "./chord-db";
import type { ChordEntry } from "./chord-db";
import type { UserChordDb } from "./user-chord-db";

type ChordsDbPosition = {
  frets: number[];
  fingers?: number[];
  baseFret: number;
  barres?: number[];
  capo?: boolean;
  midi?: number[];
};

type ChordsDbEntry = {
  key: string;
  suffix: string;
  positions: ChordsDbPosition[];
};

type GuitarJson = {
  keys: string[];
  suffixes: string[];
  chords: Record<string, ChordsDbEntry[]>;
};

// Static import so Next.js bundles the JSON into the client chunks (and Docker standalone
// output). Dynamic import was getting tree-shaken out of the production build.
import guitarData from "@tombatossals/chords-db/lib/guitar.json";

const GUITAR_CHORDS = (guitarData as unknown as GuitarJson).chords;

async function getGuitarChords(): Promise<Record<string, ChordsDbEntry[]>> {
  return GUITAR_CHORDS;
}

/**
 * Look up a chord diagram. Tries, in order:
 *   1. User overrides (per-user custom voicings) — highest priority
 *   2. Curated DB (hand-crafted beginner voicings) — preferred when we have one
 *   3. @tombatossals/chords-db (hundreds of voicings)
 *   4. null (caller shows chord name in text only)
 *
 * @param name e.g. "C", "Cm", "Cmaj7", "C/E", "F#dim7"
 * @param userOverrides optional per-user chord overrides checked first
 */
export async function lookupChord(name: string, userOverrides?: UserChordDb): Promise<ChordEntry | null> {
  // Strip slash-bass before curated lookup ("C/E" -> "C", "G/B" -> "G")
  const nameWithoutBass = name.replace(/\/[A-Ga-g][#b]?$/, "").trim();

  // 0. User overrides — checked before everything else
  if (userOverrides) {
    if (userOverrides[nameWithoutBass]) return userOverrides[nameWithoutBass];
    if (userOverrides[name]) return userOverrides[name];
    // Also try normalized key (e.g. "Cadd9" -> "C" in user overrides)
    const normalizedForUser = normalizeChordInOverrides(nameWithoutBass, userOverrides);
    if (normalizedForUser) return normalizedForUser;
  }

  // 1. Curated override: check full slash name first (D/C, G/B etc.), then base chord
  if (CHORD_DB[name]) return CHORD_DB[name];
  const curatedKey = normalizeChord(nameWithoutBass);
  if (curatedKey && CHORD_DB[curatedKey]) return CHORD_DB[curatedKey];

  // 2. chords-db fallback
  const parsed = parseChordName(name);
  if (!parsed) return null;

  const allChords = await getGuitarChords();
  const chordList = allChords[parsed.dbKey];
  if (!chordList) return null;

  const entry = chordList.find((c) => c.suffix === parsed.suffix);
  if (!entry || entry.positions.length === 0) return null;

  // chords-db orders positions beginner-first — pick position 0
  return chordsDbToSvguitar(entry.positions[0]);
}

// ---------------------------------------------------------------------------
// Chord name parsing
// ---------------------------------------------------------------------------

/**
 * Map any root spelling to the chords-db key name.
 * chords-db uses: C, Csharp, D, Eb, E, F, Fsharp, G, Ab, A, Bb, B
 */
const RAW_TO_DB_KEY: Record<string, string> = {
  C: "C",
  "C#": "Csharp",
  Db: "Csharp",
  D: "D",
  "D#": "Eb",
  Eb: "Eb",
  E: "E",
  "E#": "F",
  Fb: "E",
  F: "F",
  "F#": "Fsharp",
  Gb: "Fsharp",
  G: "G",
  "G#": "Ab",
  Ab: "Ab",
  A: "A",
  "A#": "Bb",
  Bb: "Bb",
  B: "B",
  "B#": "C",
  Cb: "B",
};

function parseChordName(
  name: string
): { dbKey: string; suffix: string } | null {
  // Strip slash-bass notation ("C/E" -> "C", "G/B" -> "G")
  const withoutBass = name.replace(/\/[A-Ga-g][#b]?$/, "").trim();

  const m = withoutBass.match(/^([A-G])([#b]?)(.*)$/);
  if (!m) return null;

  const [, root, accidental, rest] = m;
  const raw = root + accidental;

  const dbKey = RAW_TO_DB_KEY[raw];
  if (!dbKey) return null;

  const suffix = rest === "" ? "major" : mapSuffix(rest);
  return { dbKey, suffix };
}

const SUFFIX_ALIASES: Record<string, string> = {
  // Major
  "": "major",
  M: "major",
  maj: "major",
  // Minor
  m: "minor",
  min: "minor",
  "-": "minor",
  // Dominant 7
  "7": "7",
  dom7: "7",
  // Major 7
  maj7: "maj7",
  M7: "maj7",
  "△7": "maj7",
  // Minor 7
  m7: "m7",
  min7: "m7",
  "-7": "m7",
  // Minor major 7
  mmaj7: "mmaj7",
  mM7: "mmaj7",
  // Dim / half-dim
  dim: "dim",
  o: "dim",
  "°": "dim",
  dim7: "dim7",
  "o7": "dim7",
  "°7": "dim7",
  m7b5: "m7b5",
  "ø7": "m7b5",
  ø: "m7b5",
  // Aug
  aug: "aug",
  "+": "aug",
  // Sus
  sus: "sus4",
  sus2: "sus2",
  sus4: "sus4",
  // Extensions
  "6": "6",
  "69": "69",
  "9": "9",
  "11": "11",
  "13": "13",
  maj9: "maj9",
  maj11: "maj11",
  maj13: "maj13",
  m9: "m9",
  m11: "m11",
  add9: "add9",
  madd9: "madd9",
  // 7sus4
  "7sus4": "7sus4",
};

function mapSuffix(s: string): string {
  if (SUFFIX_ALIASES[s] !== undefined) return SUFFIX_ALIASES[s];
  return s;
}

// ---------------------------------------------------------------------------
// Convert chords-db position to svguitar Chord
// ---------------------------------------------------------------------------

function chordsDbToSvguitar(pos: ChordsDbPosition): ChordEntry {
  // chords-db frets array: index 0 = string 6 (low E), index 5 = string 1 (high E).
  // fret value -1 = muted, 0 = open, N>=1 = baseFret + (N - 1).
  const fingers: ChordEntry["fingers"] = pos.frets.map((fret, i) => {
    const svString = 6 - i; // index 0 -> string 6, index 5 -> string 1
    if (fret < 0) return [svString, "x" as const];
    if (fret === 0) return [svString, 0 as const];
    const absoluteFret = pos.baseFret + fret - 1;
    return [svString, absoluteFret];
  });

  // barres: each value is a fret number relative to 1=baseFret.
  // Determine string extent by finding which string indices share that fret value.
  const barres: ChordEntry["barres"] = (pos.barres ?? []).map((bareRel) => {
    const matchingIndices = pos.frets
      .map((f, i) => (f === bareRel ? i : -1))
      .filter((i) => i >= 0);

    // Convert indices (0=low E=string6) to svguitar string numbers (6=low E, 1=high E)
    const svStrings = matchingIndices.map((i) => 6 - i);
    const fromString = Math.max(...svStrings); // lowest string number = highest-numbered string (low E side)
    const toString = Math.min(...svStrings); // highest string number = lowest-numbered string (high E side)

    const absoluteFret = pos.baseFret + bareRel - 1;
    return { fromString, toString, fret: absoluteFret };
  });

  // Set position indicator when chord doesn't start at fret 1
  const result: ChordEntry = { fingers, barres };
  if (pos.baseFret > 1) {
    result.position = pos.baseFret;
  }

  return result;
}

// ---------------------------------------------------------------------------
// User overrides helpers
// ---------------------------------------------------------------------------

/**
 * Check if a chord name (or any of its normalized fallbacks) exists in the user overrides.
 * Returns the override entry if found, null otherwise.
 */
function normalizeChordInOverrides(name: string, overrides: UserChordDb): ChordEntry | null {
  if (!name) return null;
  if (overrides[name]) return overrides[name];

  const fallbacks: Array<(n: string) => string | null> = [
    n => n.replace(/add\d+$/, ""),
    n => n.replace(/9$/, "7"),
    n => n.replace(/maj9$/, "maj7"),
    n => n.replace(/(?<!maj)9$/, "7"),
    n => n.replace(/7b5$/, "7"),
    n => n.replace(/7b5$/, ""),
    n => n.replace(/dim7?$/, "m"),
    n => n.replace(/aug$/, ""),
    n => n.replace(/maj7$/, ""),
    n => n.replace(/m7$/, "m"),
    n => n.replace(/7$/, ""),
    n => n.replace(/sus[24]?$/, ""),
    n => n.replace(/m$/, ""),
  ];

  for (const transform of fallbacks) {
    const candidate = transform(name);
    if (candidate && candidate !== name) {
      if (overrides[candidate]) return overrides[candidate];
      const deeper = normalizeChordInOverrides(candidate, overrides);
      if (deeper) return deeper;
    }
  }

  return null;
}
