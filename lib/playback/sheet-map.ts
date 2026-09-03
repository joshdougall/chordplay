/**
 * Maps a position in the song to a position in the rendered sheet, and back.
 *
 * Pure by design: Vitest runs in the `node` environment, and even under JSDOM
 * there is no layout, so anything that reads `offsetTop` cannot be unit-tested.
 * Geometry is read by `lib/playback/sheet-lines.ts` and handed here as plain
 * data.
 */

// Weight given to a "sparse" unit (chord-only, no lyrics: a finger-picking
// intro, an instrumental bridge). Sung units weight 1.0. Lower = the clock
// spends less time on instrumental sections.
export const SPARSE_UNIT_WEIGHT = 0.25;

/** One rendered line of the sheet, as geometry rather than DOM. */
export type LineFacts = {
  /** Vertical offset within the scroll container's content, in the same space
   *  as `scrollTop`. NOT `offsetTop`: nothing between a sheet line and <body>
   *  is positioned, so `offsetTop` would include the whole header stack. */
  top: number;
  chordCount: number;
  chordNames: string[];
  /** Horizontal offset of each chord, so intra-line order survives. */
  chordLefts: number[];
  hasLyricText: boolean;
};

export type SheetMap = {
  unitTops: number[];
  /** Line each unit's highlight belongs on: the lyric line of a pair. */
  unitLineIndex: number[];
  /** Line each unit's chords come from. */
  unitFirstLine: number[];
  cumWeight: number[];
  totalWeight: number;
};

/**
 * Group rendered lines into weighted units.
 *
 * Positional sheets (44 of the library's 47) put the chords and the words on
 * separate sibling lines:
 *
 *         C            G
 *   When I find myself in times
 *
 * so a unit is a chord line plus the lyric line beneath it. The inline
 * renderer puts both in one `.row`, which this same rule leaves as a unit of
 * one, because such a line reports chords AND lyric text and so never triggers
 * pairing. That is why no renderer flag is needed.
 *
 * Returns null when there is nothing to weight, which makes every consumer fall
 * back to linear positioning.
 */
export function buildSheetMap(lines: LineFacts[]): SheetMap | null {
  const unitTops: number[] = [];
  const unitLineIndex: number[] = [];
  const unitFirstLine: number[] = [];
  const cumWeight: number[] = [];
  let total = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isChordOnly = line.chordCount > 0 && !line.hasLyricText;
    const next = i + 1 < lines.length ? lines[i + 1] : null;
    const pairs =
      isChordOnly && next !== null && next.chordCount === 0 && next.hasLyricText;

    let weight: number;
    let highlightLine: number;
    let consumed: number;

    if (pairs) {
      weight = 1.0;
      highlightLine = i + 1;
      consumed = 2;
    } else {
      highlightLine = i;
      consumed = 1;
      if (line.chordCount > 0 && line.hasLyricText) weight = 1.0;
      else if (line.chordCount > 0) weight = SPARSE_UNIT_WEIGHT;
      else if (line.hasLyricText) weight = 1.0;
      else weight = 0; // Blank line. Layout, not music.
    }

    // A zero-weight unit takes no time and would only create a highlight that
    // lands on nothing, so it is dropped rather than recorded.
    if (weight > 0) {
      total += weight;
      unitTops.push(line.top);
      unitLineIndex.push(highlightLine);
      unitFirstLine.push(i);
      cumWeight.push(total);
    }

    i += consumed;
  }

  if (unitTops.length === 0) return null;
  return { unitTops, unitLineIndex, unitFirstLine, cumWeight, totalWeight: total };
}
