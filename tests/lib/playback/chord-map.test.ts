import { describe, it, expect } from "vitest";
import {
  buildSheetMap,
  buildChordMap,
  cueIndexAtFraction,
  type LineFacts,
} from "@/lib/playback/sheet-map";

function chordLine(top: number, names: string[], lefts?: number[]): LineFacts {
  return {
    top,
    chordCount: names.length,
    chordNames: names,
    chordLefts: lefts ?? names.map((_, i) => i * 40),
    hasLyricText: false,
    isSectionHeader: false,
  };
}
function lyricLine(top: number): LineFacts {
  return {
    top, chordCount: 0, chordNames: [], chordLefts: [], hasLyricText: true,
    isSectionHeader: false,
  };
}
function inlineRow(top: number, names: string[]): LineFacts {
  return {
    top,
    chordCount: names.length,
    chordNames: names,
    chordLefts: names.map((_, i) => i * 40),
    hasLyricText: true,
    isSectionHeader: false,
  };
}

describe("buildChordMap", () => {
  it("returns chords in document order across units", () => {
    const lines = [
      chordLine(0, ["C", "G"]), lyricLine(20),
      chordLine(40, ["Am", "F"]), lyricLine(60),
    ];
    const cues = buildChordMap(buildSheetMap(lines)!, lines);
    expect(cues.map(c => c.name)).toEqual(["C", "G", "Am", "F"]);
  });

  it("puts the first chord of the song at fraction 0", () => {
    const lines = [inlineRow(0, ["C"]), inlineRow(100, ["G"])];
    const cues = buildChordMap(buildSheetMap(lines)!, lines);
    expect(cues[0].fraction).toBe(0);
  });

  it("starts each unit's first chord exactly at the unit boundary", () => {
    // A chord sounds when its line begins, not halfway through it.
    const lines = [inlineRow(0, ["C"]), inlineRow(100, ["G"])];
    const cues = buildChordMap(buildSheetMap(lines)!, lines);
    expect(cues[1].fraction).toBeCloseTo(0.5, 5);
  });

  it("distributes several chords across the unit's own span", () => {
    const lines = [inlineRow(0, ["C", "F", "G", "Am"])];
    const cues = buildChordMap(buildSheetMap(lines)!, lines);
    expect(cues.map(c => c.fraction)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it("orders chords within a line by horizontal position, not DOM order", () => {
    const lines = [chordLine(0, ["G", "C"], [200, 10]), lyricLine(20)];
    const cues = buildChordMap(buildSheetMap(lines)!, lines);
    expect(cues.map(c => c.name)).toEqual(["C", "G"]);
  });

  it("gives a sparse instrumental unit a proportionally smaller span", () => {
    const lines = [
      chordLine(0, ["C"]),      // sparse, 0.25 of 1.25
      inlineRow(100, ["G"]),    // sung, 1.0 of 1.25
    ];
    const cues = buildChordMap(buildSheetMap(lines)!, lines);
    expect(cues[0].fraction).toBe(0);
    expect(cues[1].fraction).toBeCloseTo(0.25 / 1.25, 5);
  });

  it("returns an empty list for a sheet with no chords", () => {
    const lines = [lyricLine(0), lyricLine(20)];
    expect(buildChordMap(buildSheetMap(lines)!, lines)).toEqual([]);
  });

  it("produces non-decreasing fractions", () => {
    const lines = [
      chordLine(0, ["C", "G"]), lyricLine(20),
      chordLine(40, ["Am"]),
      chordLine(60, ["F", "C", "G"]), lyricLine(80),
    ];
    const cues = buildChordMap(buildSheetMap(lines)!, lines);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].fraction).toBeGreaterThanOrEqual(cues[i - 1].fraction);
    }
  });
});

describe("cueIndexAtFraction", () => {
  const cues = [
    { name: "C", fraction: 0 },
    { name: "G", fraction: 0.25 },
    { name: "Am", fraction: 0.5 },
    { name: "F", fraction: 0.75 },
  ];

  it("holds the first chord before the second arrives", () => {
    expect(cueIndexAtFraction(0, cues)).toBe(0);
    expect(cueIndexAtFraction(0.24, cues)).toBe(0);
  });

  it("advances exactly on a cue boundary", () => {
    expect(cueIndexAtFraction(0.25, cues)).toBe(1);
  });

  it("holds the last chord to the end", () => {
    expect(cueIndexAtFraction(0.99, cues)).toBe(3);
    expect(cueIndexAtFraction(1, cues)).toBe(3);
  });

  it("returns -1 for an empty cue list rather than throwing", () => {
    expect(cueIndexAtFraction(0.5, [])).toBe(-1);
  });
});
