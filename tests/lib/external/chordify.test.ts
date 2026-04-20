import { describe, it, expect } from "vitest";
import {
  toChordifySlug,
  extractFirstChordifyLink,
  extractChordifyContent,
} from "@/lib/external/chordify";

describe("toChordifySlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(toChordifySlug("Radiohead Creep")).toBe("radiohead-creep");
  });

  it("strips special characters", () => {
    expect(toChordifySlug("AC/DC Back in Black")).toBe("ac-dc-back-in-black");
  });

  it("collapses multiple separators", () => {
    expect(toChordifySlug("Hey  Jude!!")).toBe("hey-jude");
  });

  it("strips leading/trailing hyphens", () => {
    expect(toChordifySlug("  hello world  ")).toBe("hello-world");
  });
});

describe("extractFirstChordifyLink", () => {
  it("extracts the first /chords/ markdown link", () => {
    const md = `
## Results

- [Creep by Radiohead](/chords/radiohead-creep-abc123)
- [Another song](/chords/other-artist-song-xyz)
    `;
    expect(extractFirstChordifyLink(md)).toBe(
      "https://chordify.net/chords/radiohead-creep-abc123"
    );
  });

  it("returns null when no /chords/ links present", () => {
    const md = "No links here at all.";
    expect(extractFirstChordifyLink(md)).toBeNull();
  });

  it("skips /chords/ category pages (single-letter slug)", () => {
    // /chords/c is a category browse page — slug is only 1 char, skip it
    // /chords/radiohead-song-abc123 is a real song page and should be returned
    const md = "[Browse](/chords/c) [Song](/chords/radiohead-song-abc123)";
    expect(extractFirstChordifyLink(md)).toBe(
      "https://chordify.net/chords/radiohead-song-abc123"
    );
  });

  it("handles bare https://chordify.net URLs", () => {
    const md = "Check this: https://chordify.net/chords/radiohead-creep-hash";
    expect(extractFirstChordifyLink(md)).toBe(
      "https://chordify.net/chords/radiohead-creep-hash"
    );
  });
});

describe("extractChordifyContent", () => {
  it("returns null when no chord lines are found", () => {
    const md = "Just some lyrics\nNo chords here\nOnly words";
    expect(extractChordifyContent(md, "Song", "Artist")).toBeNull();
  });

  it("converts chord-only lines to inline ChordPro markers", () => {
    const md = `
G D Em C

Some lyrics here
`;
    const result = extractChordifyContent(md, "My Song", "My Artist");
    expect(result).not.toBeNull();
    expect(result).toContain("[G] [D] [Em] [C]");
    expect(result).toContain("{title: My Song}");
    expect(result).toContain("{artist: My Artist}");
  });

  it("converts section headers to {comment: ...} directives", () => {
    const md = `
## Verse

G D

Some lyrics

## Chorus

C G
`;
    const result = extractChordifyContent(md, "Song", "Artist");
    expect(result).toContain("{comment: Verse}");
    expect(result).toContain("{comment: Chorus}");
  });

  it("skips headings that contain the song title", () => {
    const md = `
# My Song by Artist

G D Em C
`;
    const result = extractChordifyContent(md, "My Song", "Artist");
    // The heading "My Song by Artist" should not appear as a comment
    expect(result).not.toContain("{comment: My Song by Artist}");
    expect(result).toContain("[G] [D] [Em] [C]");
  });

  it("handles complex chord names", () => {
    const md = "Cmaj7 G/B Am7 Dsus4";
    const result = extractChordifyContent(md, "Song", "Artist");
    expect(result).not.toBeNull();
    expect(result).toContain("[Cmaj7] [G/B] [Am7] [Dsus4]");
  });

  it("treats mixed chord-and-lyric lines as lyric lines", () => {
    // "G hello" — "hello" is not a chord, so whole line is treated as lyric
    // No foundContent means we need at least one pure chord line
    const md = "G D\nG hello D world\nEm C";
    const result = extractChordifyContent(md, "Song", "Artist");
    // Pure chord lines G D and Em C should be found
    expect(result).toContain("[G] [D]");
    expect(result).toContain("[Em] [C]");
    // Mixed line treated as lyric text
    expect(result).toContain("G hello D world");
  });
});
