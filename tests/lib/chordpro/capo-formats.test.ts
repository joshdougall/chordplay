import { describe, it, expect } from "vitest";
import { parseCapoDirective } from "@/lib/chordpro/capo";

describe("parseCapoDirective — spellings that already worked", () => {
  it.each([
    ["{capo: 2}", 2],
    ["CAPO: 1st FRET", 1],
    ["Capo II", 2],
    ["capo 3", 3],
    ["Capo 5th", 5],
    ["Capo: 2nd fret", 2],
    ["  Capo 2", 2],
  ])("%s -> %i", (src, want) => {
    expect(parseCapoDirective(src)).toBe(want);
  });
});

describe("parseCapoDirective — spellings reported missing from real sheets", () => {
  it.each([
    ["Capo on 2nd fret", 2],
    ["Capo at 3rd fret", 3],
    ["(Capo 2)", 2],
    ["[Capo 4]", 4],
    ["*Capo 3*", 3],
    ["Capo - 4", 4],
    ["Capo — 5", 5],
    ["Tuning: Standard, Capo 2", 2],
    ["Tuning: EADGBE; capo 1", 1],
  ])("%s -> %i", (src, want) => {
    expect(parseCapoDirective(src)).toBe(want);
  });
});

describe("parseCapoDirective — must NOT match", () => {
  it.each([
    "No capo",
    "Capo: none",
    "capo: n/a",
    "Without a capo",
    "I put a capo on my heart",          // lyric
    "She sang it with a capo 2 fret up", // lyric containing a number
    "Capo",                              // no fret given
    "Capo 0",                            // out of range
    "Capo 13",                           // out of range
    "Well, capo 5 was all he had",             // lyric with a comma lead-in
    "and I sang, capo 2 in my hand",           // lyric with a comma lead-in
    "(capo 3) she whispered",                  // decoration but a lyric follows
    "Capo I have never seen a capo like this", // roman-numeral collision with "I"
    "No capo, but capo 2 works too",           // negation followed by a number
  ])("%s -> null", (src) => {
    expect(parseCapoDirective(src)).toBeNull();
  });
});

describe("parseCapoDirective — scope", () => {
  it("finds a {capo:} directive anywhere in the file", () => {
    const late = ["[Verse 1]", "words words", "", "{capo: 4}"].join("\n");
    expect(parseCapoDirective(late)).toBe(4);
  });

  it("only reads prose capo lines from the preamble, so a late lyric cannot win", () => {
    const lines = ["Capo 2", "[Verse 1]"];
    for (let i = 0; i < 40; i++) lines.push(`line ${i} of lyrics`);
    lines.push("capo 9 in the second bridge");
    expect(parseCapoDirective(lines.join("\n"))).toBe(2);
  });

  it("takes the first capo when a sheet states it twice", () => {
    expect(parseCapoDirective("Capo 2\nCapo 5")).toBe(2);
  });

  it("returns null for a sheet with no capo at all", () => {
    expect(parseCapoDirective("[Verse]\n[C]hello [G]world")).toBeNull();
  });

  it("ignores a prose capo that appears only past the preamble", () => {
    const lines: string[] = [];
    for (let i = 0; i < 30; i++) lines.push(`line ${i} of lyrics`);
    lines.push("Capo 6");
    expect(parseCapoDirective(lines.join("\n"))).toBeNull();
  });
});
