import { describe, it, expect } from "vitest";
import { chordsOverLyricsToChordPro } from "@/lib/external/chord-over-lyrics";

describe("chordsOverLyricsToChordPro", () => {
  it("merges a simple chord-over-lyric pair", () => {
    const input = "G\nHello world";
    const result = chordsOverLyricsToChordPro(input);
    expect(result).toBe("[G]Hello world");
  });

  it("merges chords with column offsets", () => {
    const input = "     G          D\nWhen you were here before";
    const result = chordsOverLyricsToChordPro(input);
    expect(result).toContain("[G]");
    expect(result).toContain("[D]");
  });

  it("passes through already-inline ChordPro content unchanged", () => {
    const input = "[G]Hey [D]Jude, don't make it [Em]bad";
    expect(chordsOverLyricsToChordPro(input)).toBe(input);
  });

  it("passes through content with [Am7] inline markers unchanged", () => {
    const input = "[Am7]some [D/F#]complex chords";
    expect(chordsOverLyricsToChordPro(input)).toBe(input);
  });

  it("preserves empty lines between sections", () => {
    const input = "G\nVerse line\n\nC\nChorus line";
    const result = chordsOverLyricsToChordPro(input);
    expect(result).toContain("\n\n");
    expect(result).toContain("[G]");
    expect(result).toContain("[C]");
  });

  it("does not merge chord line followed by empty line", () => {
    // Chord line with no lyric line after it — should be left as-is
    const input = "G\n\nSome lyrics";
    const result = chordsOverLyricsToChordPro(input);
    // The chord line G is followed by empty, so it should remain a standalone line
    expect(result).toContain("G");
    expect(result).toContain("Some lyrics");
  });

  it("handles mixed content (section headers + chord-lyric pairs)", () => {
    const input = "[Verse]\nG          D\nWhen you were here before\n\n[Chorus]\nC      Cm\nYou float";
    const result = chordsOverLyricsToChordPro(input);
    // [Verse] and [Chorus] are not chord lines so they pass through
    expect(result).toContain("[Verse]");
    expect(result).toContain("[Chorus]");
    // Chord-lyric pairs should be merged
    expect(result).toContain("[G]");
    expect(result).toContain("[C]");
  });

  it("handles chord line with slash chords (D/F#)", () => {
    const input = "D/F#\nsome lyrics here";
    const result = chordsOverLyricsToChordPro(input);
    expect(result).toContain("[D/F#]");
    // Chord is at column 0, so it's prepended to the lyric
    expect(result).toBe("[D/F#]some lyrics here");
  });

  it("handles multi-chord lines with proper column alignment", () => {
    const input = "G      B7     C\nWhen you were here before";
    const result = chordsOverLyricsToChordPro(input);
    expect(result).toContain("[G]");
    expect(result).toContain("[B7]");
    expect(result).toContain("[C]");
  });

  it("returns empty string unchanged", () => {
    expect(chordsOverLyricsToChordPro("")).toBe("");
  });
});
