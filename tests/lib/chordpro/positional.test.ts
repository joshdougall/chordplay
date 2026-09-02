import { describe, it, expect } from "vitest";
import { isPositionalSheet, renderPositional } from "@/lib/chordpro/positional";
import { stripMetaPreamble } from "@/lib/chordpro/strip-meta";

const SNOWSHOES = `{title: Snowshoes}
{key: D}

[Intro]
[Dmaj7]   [A]   [Dmaj7]   [A]

[Verse 1]
           [Dmaj7]
I hope you know if I go there
 [A]
That I'm goin' there for you`;

const INLINE = `{title: X}

[C]Hello [G]world, this is [Am]inline`;

/** Flatten one rendered line back to plain text, as the <pre> will show it. */
const text = (line: { segments: { text: string }[] }) =>
  line.segments.map(s => s.text).join("");

describe("isPositionalSheet", () => {
  it("detects a sheet whose chords sit on their own lines", () => {
    expect(isPositionalSheet(SNOWSHOES)).toBe(true);
  });

  it("does not claim an inline ChordPro sheet", () => {
    expect(isPositionalSheet(INLINE)).toBe(false);
  });

  it("does not claim a sheet with no chords at all", () => {
    expect(isPositionalSheet("{title: X}\n\njust words here")).toBe(false);
  });
});

describe("renderPositional + preamble stripping", () => {
  it("positional sheets must go through the preamble stripper too", () => {
    // Regression: renderPositional was fed the RAW source while only the inline
    // renderer got the stripped text, so positional sheets still opened on
    // scraper junk after the stripper was fixed. Caught live on Snowshoes.
    const withJunk = `{title: Snowshoes}

SNOWSHOES
As recorded by Caamp
(From the 2022 Album LAVENDER DAYS)

[Intro]
[Dmaj7]   [A]

[Verse 1]
           [Dmaj7]
I hope you know if I go there`;
    const { lines } = renderPositional(stripMetaPreamble(withJunk), 0);
    const all = lines.map(l => l.segments.map(s => s.text).join("")).join("\n");
    expect(all).not.toMatch(/As recorded by/);
    expect(all).not.toMatch(/LAVENDER DAYS/);
    expect(all).toMatch(/Intro/);
    expect(all).toMatch(/I hope you know/);
  });
});

describe("renderPositional", () => {
  it("preserves the column a chord sits in", () => {
    const { lines } = renderPositional(SNOWSHOES, 0);
    // Target the verse chord line: the one directly above the lyric it belongs
    // to. The intro line legitimately starts at column 0.
    const lyricIdx = lines.findIndex(l => text(l).includes("I hope you know"));
    const chordLine = lines[lyricIdx - 1];
    // 11 spaces in the source, so the chord must still start at column 11.
    expect(text(chordLine).indexOf("Dmaj7")).toBe(11);
  });

  it("keeps the lyric line directly beneath, untouched", () => {
    const { lines } = renderPositional(SNOWSHOES, 0);
    const lyric = lines.find(l => text(l).includes("I hope you know"))!;
    expect(text(lyric)).toBe("I hope you know if I go there");
  });

  it("strips the brackets — they are markup, not something to read", () => {
    const { lines } = renderPositional(SNOWSHOES, 0);
    expect(lines.every(l => !text(l).includes("["))).toBe(true);
  });

  it("marks chord segments so they can be styled and clicked", () => {
    const { lines } = renderPositional(SNOWSHOES, 0);
    const chords = lines.flatMap(l => l.segments.filter(s => s.isChord).map(s => s.text.trim()));
    expect(chords).toContain("Dmaj7");
    expect(chords).toContain("A");
  });

  it("transposes chords while holding their start columns", () => {
    const { lines } = renderPositional(SNOWSHOES, 1);
    const lyricIdx = lines.findIndex(l => text(l).includes("I hope you know"));
    const chordLine = lines[lyricIdx - 1];
    const first = chordLine.segments.find(s => s.isChord)!;
    expect(first.text.trim()).toBe("D#maj7");
    expect(text(chordLine).indexOf("D#maj7")).toBe(11);
  });

  it("never lets a longer transposed chord swallow the next one", () => {
    const { lines } = renderPositional("[C]   [G]\nlyric line", 1);
    const line = lines[0];
    const names = line.segments.filter(s => s.isChord).map(s => s.text.trim());
    expect(names).toEqual(["C#", "G#"]);
    expect(text(line)).toMatch(/C#\s+G#/);
  });

  it("reports the unique chords for the diagram palette", () => {
    const { uniqueChords } = renderPositional(SNOWSHOES, 0);
    expect(uniqueChords).toEqual(["Dmaj7", "A"]);
  });
});
