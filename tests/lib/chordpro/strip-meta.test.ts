import { describe, it, expect } from "vitest";
import { stripMetaPreamble } from "@/lib/chordpro/strip-meta";

describe("stripMetaPreamble — chord summary lines", () => {
  it("strips a chord-only summary line at the top", () => {
    const input = "C5 D5 A5 B5 C5 B5 G5\n\n[C]Hello [G]world";
    const result = stripMetaPreamble(input);
    expect(result).not.toContain("C5 D5 A5 B5");
    expect(result).toContain("[C]Hello [G]world");
  });

  it("preserves a chord summary line that appears mid-song (not preamble)", () => {
    const input = "[C]Hello [G]world\nC5 D5 A5";
    const result = stripMetaPreamble(input);
    expect(result).toContain("C5 D5 A5");
  });

  it("does not include preamble chords in parsed content (palette isolation)", () => {
    // Chords in the summary that are NOT used in the body should not appear after strip
    const input = "A5 B5 C5\n\n[G]Some lyrics [D]here";
    const result = stripMetaPreamble(input);
    // The stripped result should contain only the real content
    expect(result).toContain("[G]Some lyrics [D]here");
    expect(result).not.toContain("A5 B5 C5");
  });
});

describe("stripMetaPreamble — credit lines", () => {
  it("strips 'Tabbed by' credit at the top", () => {
    const input = "Tabbed by Ray Scheidler\n[C]Hello world";
    const result = stripMetaPreamble(input);
    expect(result).not.toContain("Tabbed by");
    expect(result).toContain("[C]Hello world");
  });

  it("strips 'tabbed by' (case-insensitive)", () => {
    const input = "tabbed by someone\n[C]Hello";
    expect(stripMetaPreamble(input)).not.toContain("tabbed by");
  });

  it("strips an email address at the top", () => {
    const input = "ray@example.com\n[C]Hello world";
    const result = stripMetaPreamble(input);
    expect(result).not.toContain("ray@example.com");
    expect(result).toContain("[C]Hello world");
  });

  it("strips 'Tuning:' line", () => {
    const input = "Tuning: Standard EADGBe\n[C]Hello";
    expect(stripMetaPreamble(input)).not.toContain("Tuning:");
  });

  it("strips a URL at the top", () => {
    const input = "https://tabs.ultimate-guitar.com/tab/123\n[C]Hello";
    expect(stripMetaPreamble(input)).not.toContain("https://");
  });
});

describe("stripMetaPreamble — bare section headers", () => {
  it("strips 'INTRO: A' at the top", () => {
    const input = "INTRO: A\n\n[C]Hello [G]world";
    const result = stripMetaPreamble(input);
    expect(result).not.toContain("INTRO: A");
    expect(result).toContain("[C]Hello [G]world");
  });

  it("strips bare 'INTRO' at the top", () => {
    const input = "INTRO\n[C]Hello";
    expect(stripMetaPreamble(input)).not.toContain("INTRO");
  });

  it("strips 'Verse 1:' at the top", () => {
    const input = "Verse 1:\n[C]Hello";
    expect(stripMetaPreamble(input)).not.toContain("Verse 1:");
  });

  it("strips '[Chorus]' at the top", () => {
    const input = "[Chorus]\n[C]Hello";
    expect(stripMetaPreamble(input)).not.toContain("[Chorus]");
  });

  it("preserves section headers once real content has started", () => {
    const input = "[C]Hello [G]world\n\n[Chorus]\n[Am]More lyrics";
    const result = stripMetaPreamble(input);
    expect(result).toContain("[Chorus]");
    expect(result).toContain("[Am]More lyrics");
  });
});

describe("stripMetaPreamble — directives", () => {
  it("preserves ChordPro directives at the top", () => {
    const input = "{title: My Song}\n{key: C}\n\nTabbed by someone\n[C]Hello";
    const result = stripMetaPreamble(input);
    expect(result).toContain("{title: My Song}");
    expect(result).toContain("{key: C}");
    expect(result).not.toContain("Tabbed by");
    expect(result).toContain("[C]Hello");
  });

  it("preserves directives mixed with preamble noise", () => {
    const input = "{title: Song}\nC5 D5 A5\nTabbed by X\n[G]Lyric";
    const result = stripMetaPreamble(input);
    expect(result).toContain("{title: Song}");
    expect(result).not.toContain("C5 D5 A5");
    expect(result).not.toContain("Tabbed by");
    expect(result).toContain("[G]Lyric");
  });
});

describe("stripMetaPreamble — edge cases", () => {
  it("strips leading blank lines", () => {
    const input = "\n\n\n[C]Hello world";
    const result = stripMetaPreamble(input);
    expect(result.trimStart()).toContain("[C]Hello world");
    expect(result).not.toMatch(/^\n\n/);
  });

  it("returns empty string for all-preamble input", () => {
    const input = "Tabbed by X\nC5 D5\nINTRO: A";
    expect(stripMetaPreamble(input).trim()).toBe("");
  });

  it("stops stripping at first real lyric line", () => {
    const input = "Tabbed by X\nC5 D5\nHello world this is a lyric\n\nINTRO: A should stay";
    const result = stripMetaPreamble(input);
    expect(result).toContain("Hello world this is a lyric");
    expect(result).toContain("INTRO: A should stay");
  });

  it("handles source with no preamble unchanged (chord content only)", () => {
    const input = "[C]Hello [G]world\n[Am]Goodbye";
    const result = stripMetaPreamble(input);
    expect(result).toContain("[C]Hello [G]world");
    expect(result).toContain("[Am]Goodbye");
  });
});
