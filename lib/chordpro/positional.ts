import { Chord } from "chordsheetjs";
import { isChordName } from "@/lib/chordpro/extract-chords";

/** Transpose one chord name, using the same engine the rest of the app uses so
 *  positional sheets and inline sheets can never disagree on a chord's name. */
function transposeChord(name: string, semitones: number): string {
  try {
    const parsed = Chord.parse(name);
    return parsed ? parsed.transpose(semitones).toString() : name;
  } catch {
    return name;
  }
}

export type Segment = {
  text: string;
  isChord: boolean;
  /** True only for the bare bracketed section-header line ("[Verse 1]") with
   *  its brackets shed. Lets downstream consumers (the renderer's
   *  `sheet-section` class, and sheet-map's zero-weighting) identify a header
   *  without re-deriving the bracket shape from rendered text. */
  isHeader?: boolean;
};
export type PositionalLine = { segments: Segment[] };

/** Shape test only: a line of nothing but bracketed tokens and whitespace. */
const BRACKETED_ONLY_LINE = /^[\s]*(?:\[[^\]]+\][\s]*)+$/;

/**
 * A chord line, as opposed to a bracketed section header. "[Intro]" and
 * "[Verse 1]" match the shape above but are markers, not chords, so every
 * bracketed token must actually name a chord.
 */
function isChordOnlyLine(line: string): boolean {
  if (!BRACKETED_ONLY_LINE.test(line)) return false;
  const tokens = [...line.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim());
  return tokens.length > 0 && tokens.every(isChordName);
}
const CHORD_TOKEN = /\[([^\]]+)\]/g;
const DIRECTIVE = /^\s*\{[^}]+\}\s*$/;

/**
 * Does this sheet position its chords by column rather than inline?
 *
 * These sheets put the chord on its own line, indented so it sits above the
 * syllable it is played on. chordsheetjs' HtmlDivFormatter throws that leading
 * whitespace away — it emits an empty lyrics div — so every chord rendered
 * flush left and the timing information the sheet exists to convey was lost.
 * 44 of the 47 sheets in the library are written this way.
 */
export function isPositionalSheet(source: string): boolean {
  const lines = source.split(/\r?\n/);
  let hasChordOnlyLine = false;
  let hasPlainText = false;

  for (const line of lines) {
    if (DIRECTIVE.test(line)) continue;
    const trimmed = line.trim();
    if (trimmed === "") continue;

    if (isChordOnlyLine(line)) {
      hasChordOnlyLine = true;
      continue;
    }

    // A bracketed chord mixed with other text is the INLINE convention, which
    // the normal renderer aligns correctly. Don't take those sheets over.
    // A bare bracketed section header is neither, so it must not count here:
    // note CHORD_TOKEN is /g and .test() on it is stateful, hence a fresh one.
    const bracketed = [...line.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim());
    if (bracketed.some(isChordName)) return false;

    const withoutBrackets = trimmed.replace(/\[[^\]]*\]/g, "").trim();
    if (/[A-Za-z]/.test(withoutBrackets)) hasPlainText = true;
  }

  return hasChordOnlyLine && hasPlainText;
}

/**
 * Render a positional sheet as segments that a <pre> can display, preserving
 * every chord's original column. Chord segments are marked so the view can
 * style them and keep click-to-diagram working, which a plain text dump
 * would lose.
 */
export function renderPositional(
  source: string,
  transpose: number
): { lines: PositionalLine[]; uniqueChords: string[] } {
  const lines: PositionalLine[] = [];
  const seen = new Set<string>();
  const uniqueChords: string[] = [];

  for (const raw of source.split(/\r?\n/)) {
    if (DIRECTIVE.test(raw)) continue;

    if (!isChordOnlyLine(raw) || raw.trim() === "") {
      // Section headers keep their position but shed their brackets, which are
      // markup rather than something to read.
      const isHeader = /^\s*\[[^\]]+\]\s*$/.test(raw);
      const shown = isHeader ? raw.replace(/[\[\]]/g, "") : raw;
      const segment: Segment = { text: shown, isChord: false };
      if (isHeader) segment.isHeader = true;
      lines.push({ segments: [segment] });
      continue;
    }

    // Collect each chord with the column it starts in, then re-lay them out at
    // those same columns. A transposed name can be longer (C -> C#), so a chord
    // may have to shift right; it never shifts left, and never abuts the next.
    const placements: { col: number; name: string }[] = [];
    for (const m of raw.matchAll(CHORD_TOKEN)) {
      const name = transpose === 0 ? m[1] : transposeChord(m[1], transpose);
      placements.push({ col: m.index ?? 0, name });
      if (!seen.has(name)) { seen.add(name); uniqueChords.push(name); }
    }

    const segments: Segment[] = [];
    let col = 0;
    for (const p of placements) {
      const target = Math.max(p.col, col === 0 ? 0 : col + 1);
      if (target > col) {
        segments.push({ text: " ".repeat(target - col), isChord: false });
        col = target;
      }
      segments.push({ text: p.name, isChord: true });
      col += p.name.length;
    }
    lines.push({ segments });
  }

  return { lines, uniqueChords };
}
