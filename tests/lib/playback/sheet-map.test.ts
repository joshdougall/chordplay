import { describe, it, expect } from "vitest";
import { buildSheetMap, SPARSE_UNIT_WEIGHT, type LineFacts } from "@/lib/playback/sheet-map";

/** A line with chords and no words: a positional sheet's chord row. */
function chordLine(top: number, names: string[], lefts?: number[]): LineFacts {
  return {
    top,
    chordCount: names.length,
    chordNames: names,
    chordLefts: lefts ?? names.map((_, i) => i * 40),
    hasLyricText: false,
  };
}

/** A line with words and no chords: a positional sheet's lyric row. */
function lyricLine(top: number): LineFacts {
  return { top, chordCount: 0, chordNames: [], chordLefts: [], hasLyricText: true };
}

/** A line carrying both: an inline renderer's .row. */
function inlineRow(top: number, names: string[]): LineFacts {
  return {
    top,
    chordCount: names.length,
    chordNames: names,
    chordLefts: names.map((_, i) => i * 40),
    hasLyricText: true,
  };
}

function blankLine(top: number): LineFacts {
  return { top, chordCount: 0, chordNames: [], chordLefts: [], hasLyricText: false };
}

describe("buildSheetMap", () => {
  it("returns null for an empty sheet", () => {
    expect(buildSheetMap([])).toBeNull();
  });

  it("pairs a positional chord line with the lyric line beneath it", () => {
    // This is the case the old buildRowMap could not see at all.
    const map = buildSheetMap([
      chordLine(0, ["C", "G"]),
      lyricLine(20),
      chordLine(40, ["Am", "F"]),
      lyricLine(60),
    ])!;
    expect(map.cumWeight).toHaveLength(2);
    expect(map.totalWeight).toBe(2);
    // The unit starts at the chord line...
    expect(map.unitTops).toEqual([0, 40]);
    expect(map.unitFirstLine).toEqual([0, 2]);
    // ...but the highlight belongs on the words.
    expect(map.unitLineIndex).toEqual([1, 3]);
  });

  it("treats an inline row as one unit, since it already holds both", () => {
    const map = buildSheetMap([inlineRow(0, ["C"]), inlineRow(20, ["G"])])!;
    expect(map.totalWeight).toBe(2);
    expect(map.unitLineIndex).toEqual([0, 1]);
    expect(map.unitFirstLine).toEqual([0, 1]);
  });

  it("weights a chord-only unit sparsely, so instrumentals do not eat the clock", () => {
    const map = buildSheetMap([
      chordLine(0, ["C"]),   // instrumental: no lyric line follows
      chordLine(20, ["G"]),
      chordLine(40, ["Am"]),
      lyricLine(60),         // this one pairs
    ])!;
    // Two lone chord lines at 0.25 each, then a pair at 1.0.
    expect(map.cumWeight).toEqual([
      SPARSE_UNIT_WEIGHT,
      SPARSE_UNIT_WEIGHT * 2,
      SPARSE_UNIT_WEIGHT * 2 + 1,
    ]);
    expect(map.totalWeight).toBe(1.5);
  });

  it("gives a lyric line with no chords full weight", () => {
    // An a cappella line, or a lyric line whose chords were on a row already paired.
    const map = buildSheetMap([lyricLine(0), lyricLine(20)])!;
    expect(map.totalWeight).toBe(2);
  });

  it("drops blank lines entirely, so whitespace takes no time", () => {
    // Old behaviour gave a blank line SPARSE_ROW_WEIGHT, inflating the
    // apparent length of section gaps.
    const map = buildSheetMap([
      inlineRow(0, ["C"]),
      blankLine(20),
      blankLine(30),
      inlineRow(40, ["G"]),
    ])!;
    expect(map.totalWeight).toBe(2);
    expect(map.unitTops).toEqual([0, 40]);
  });

  it("returns null when every line is blank", () => {
    expect(buildSheetMap([blankLine(0), blankLine(10)])).toBeNull();
  });

  it("does not pair a chord line with a lyric line that has its own chords", () => {
    const map = buildSheetMap([chordLine(0, ["C"]), inlineRow(20, ["G"])])!;
    expect(map.cumWeight).toHaveLength(2);
    expect(map.unitLineIndex).toEqual([0, 1]);
  });

  it("does not pair across a blank line", () => {
    const map = buildSheetMap([chordLine(0, ["C"]), blankLine(20), lyricLine(40)])!;
    // Chord line stays a lone sparse unit; the lyric line is its own full unit.
    expect(map.cumWeight).toEqual([SPARSE_UNIT_WEIGHT, SPARSE_UNIT_WEIGHT + 1]);
    expect(map.unitLineIndex).toEqual([0, 2]);
  });

  it("leaves a trailing chord line unpaired", () => {
    const map = buildSheetMap([lyricLine(0), chordLine(20, ["C"])])!;
    expect(map.totalWeight).toBe(1 + SPARSE_UNIT_WEIGHT);
    expect(map.unitLineIndex).toEqual([0, 1]);
  });

  it("keeps unitTops monotonically increasing", () => {
    const map = buildSheetMap([
      chordLine(0, ["C"]), lyricLine(20),
      blankLine(40),
      chordLine(60, ["G"]), lyricLine(80),
    ])!;
    for (let i = 1; i < map.unitTops.length; i++) {
      expect(map.unitTops[i]).toBeGreaterThan(map.unitTops[i - 1]);
    }
  });
});
