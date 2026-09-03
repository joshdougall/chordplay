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

/** The unit boundary the forward mapping uses beyond the last unit. Both
 *  mappings must use this same expression or the round trip breaks. */
function unitEndTop(map: SheetMap, unitIdx: number, maxScroll: number): number {
  const thisTop = map.unitTops[unitIdx];
  return unitIdx + 1 < map.unitTops.length
    ? map.unitTops[unitIdx + 1]
    : Math.max(thisTop + 1, maxScroll);
}

/** Binary search for the first unit whose cumulative weight reaches `target`. */
function unitAtWeight(map: SheetMap, target: number): number {
  let lo = 0;
  let hi = map.cumWeight.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (map.cumWeight[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Which unit is sounding at `pct` through the song. */
export function unitIndexAtFraction(pct: number, map: SheetMap): number {
  const clamped = Math.max(0, Math.min(1, pct));
  if (map.totalWeight === 0) return 0;
  return unitAtWeight(map, clamped * map.totalWeight);
}

/** Song fraction -> scrollTop. Clamped to [0, maxScroll]. */
export function weightedProgressToScrollTop(
  pct: number,
  map: SheetMap,
  maxScroll: number
): number {
  if (map.totalWeight === 0 || map.unitTops.length === 0) return pct * maxScroll;
  const target = Math.max(0, Math.min(1, pct)) * map.totalWeight;
  const idx = unitAtWeight(map, target);

  const cumEnd = map.cumWeight[idx];
  const cumStart = idx > 0 ? map.cumWeight[idx - 1] : 0;
  const weight = cumEnd - cumStart;
  const intra = weight > 0 ? (target - cumStart) / weight : 0;

  const thisTop = map.unitTops[idx];
  const nextTop = unitEndTop(map, idx, maxScroll);
  return Math.max(0, Math.min(maxScroll, thisTop + (nextTop - thisTop) * intra));
}

/**
 * scrollTop -> song fraction. The inverse of weightedProgressToScrollTop.
 *
 * The forward mapping is not injective: every fraction whose interpolated
 * position lands at or beyond maxScroll clamps to maxScroll, and a sheet
 * shorter than its viewport clamps everything. So this is a LEFT inverse on the
 * unclamped interior, returning the smallest fraction that maps to a given
 * offset. Round-tripping is guaranteed only where the forward result lies
 * strictly inside (0, maxScroll); the clamped ends are defined here as 0 and 1.
 */
export function progressFractionAtOffset(
  offsetTop: number,
  map: SheetMap | null,
  maxScroll: number
): number {
  // Same linear fallback the forward mapping uses, inverted.
  if (map === null || map.totalWeight === 0 || map.unitTops.length === 0) {
    return Math.max(0, Math.min(1, offsetTop / Math.max(1, maxScroll)));
  }

  if (offsetTop <= map.unitTops[0]) return 0;

  const last = map.unitTops.length - 1;
  if (offsetTop >= unitEndTop(map, last, maxScroll)) return 1;

  // First unit whose top exceeds offsetTop, minus one, is the containing unit.
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (map.unitTops[mid] <= offsetTop) lo = mid;
    else hi = mid - 1;
  }
  const idx = lo;

  const thisTop = map.unitTops[idx];
  const nextTop = unitEndTop(map, idx, maxScroll);
  const span = nextTop - thisTop;
  const intra = span > 0 ? (offsetTop - thisTop) / span : 0;

  const cumEnd = map.cumWeight[idx];
  const cumStart = idx > 0 ? map.cumWeight[idx - 1] : 0;
  const target = cumStart + (cumEnd - cumStart) * intra;

  return Math.max(0, Math.min(1, target / map.totalWeight));
}

/** One chord occurrence, with the point in the song it is estimated to sound. */
export type ChordCue = { name: string; fraction: number };

/**
 * Flatten the sheet's chords into an ordered list of cues.
 *
 * A unit's chords are spread across that unit's own fraction span, so the
 * first chord of a line lands exactly on the line boundary rather than halfway
 * into it: a chord sounds when its line starts.
 */
export function buildChordMap(map: SheetMap, lines: LineFacts[]): ChordCue[] {
  const cues: ChordCue[] = [];
  if (map.totalWeight === 0) return cues;

  for (let u = 0; u < map.unitFirstLine.length; u++) {
    const line = lines[map.unitFirstLine[u]];
    if (!line || line.chordCount === 0) continue;

    const cumEnd = map.cumWeight[u];
    const cumStart = u > 0 ? map.cumWeight[u - 1] : 0;
    const start = cumStart / map.totalWeight;
    const end = cumEnd / map.totalWeight;

    // Horizontal position is the timing information a positional sheet carries,
    // so order by it rather than trusting DOM order.
    const order = line.chordNames
      .map((name, i) => ({ name, left: line.chordLefts[i] ?? i }))
      .sort((a, b) => a.left - b.left);

    for (let j = 0; j < order.length; j++) {
      cues.push({
        name: order[j].name,
        fraction: start + (end - start) * (j / order.length),
      });
    }
  }

  return cues;
}

/** Which cue is sounding at `pct`. Returns -1 for an empty list. */
export function cueIndexAtFraction(pct: number, cues: ChordCue[]): number {
  if (cues.length === 0) return -1;
  const clamped = Math.max(0, Math.min(1, pct));
  let lo = 0;
  let hi = cues.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cues[mid].fraction <= clamped) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
