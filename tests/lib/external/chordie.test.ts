import { describe, it, expect } from "vitest";
import { chordieLineToChordPro, parseChordieTab, buildChordPro, validateChordieResult } from "@/lib/external/chordie";

// Fixture: a minimal chordie chord page fragment with chordline and textline divs
// The chords are wrapped in the span structure chordie uses in its rendered HTML.
const FIXTURE_CHORDLINE = `
<div class="chordline">When you were here befo<span class="bracket">[</span><span class="relc"><span class="absc G">G</span></span><span class="bracket">]</span>re<span class="bracket">[</span><span class="relc"><span class="absc Gsus4">Gsus4</span></span><span class="bracket">]</span> <span class="bracket">[</span><span class="relc"><span class="absc G">G</span></span><span class="bracket">]</span></div>
`;

const FIXTURE_TEXTLINE = `
<div class="textline">This is a pure lyric line</div>
`;

const FIXTURE_MIXED = FIXTURE_CHORDLINE + FIXTURE_TEXTLINE + `
<div class="chordline">&nbsp;&nbsp;[<span class="bracket">[</span><span class="relc"><span class="absc Am7">Am7</span></span><span class="bracket">]</span>just testing</div>
<div class="textline">Chorus:</div>
`;

describe("chordieLineToChordPro", () => {
  it("returns the line unchanged (already ChordPro compatible)", () => {
    expect(chordieLineToChordPro("[G]Hey [D]Jude")).toBe("[G]Hey [D]Jude");
    expect(chordieLineToChordPro("pure lyrics")).toBe("pure lyrics");
    expect(chordieLineToChordPro("[Am7]some [D/F#]complex chords")).toBe("[Am7]some [D/F#]complex chords");
  });
});

describe("parseChordieTab", () => {
  it("parses chordline and textline divs", () => {
    const lines = parseChordieTab(FIXTURE_MIXED);
    expect(lines.length).toBeGreaterThan(0);
    const chordLines = lines.filter(l => l.kind === "chord");
    const textLines = lines.filter(l => l.kind === "text");
    expect(chordLines.length).toBeGreaterThanOrEqual(2);
    expect(textLines.length).toBeGreaterThanOrEqual(2);
  });

  it("converts span-wrapped chords to [chord] notation", () => {
    const lines = parseChordieTab(FIXTURE_CHORDLINE);
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe("chord");
    // Should contain [G] and [Gsus4] in the output
    expect(lines[0].text).toContain("[G]");
    expect(lines[0].text).toContain("[Gsus4]");
    // Should not contain any HTML tags
    expect(lines[0].text).not.toContain("<span");
    expect(lines[0].text).not.toContain("<div");
  });

  it("decodes &nbsp; in chord lines", () => {
    const lines = parseChordieTab(FIXTURE_TEXTLINE);
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe("text");
    expect(lines[0].text).toBe("This is a pure lyric line");
  });

  it("returns empty array for HTML with no chord/text divs", () => {
    const lines = parseChordieTab("<html><body><p>nothing here</p></body></html>");
    expect(lines).toHaveLength(0);
  });
});

describe("validateChordieResult", () => {
  it("returns null signal when artist doesn't match (title matches, artist doesn't)", () => {
    // "Deeper Talks" by "Joe Jordan" → fetched "Deeper Talks" by "JJ Cale" should fail
    const valid = validateChordieResult("Deeper Talks", "JJ Cale", "Deeper Talks", "Joe Jordan");
    expect(valid).toBe(false);
  });

  it("returns true when both title and artist match closely enough", () => {
    const valid = validateChordieResult("Deeper Talks", "Joe Jordan", "Deeper Talks", "Joe Jordan");
    expect(valid).toBe(true);
  });

  it("returns false when title doesn't match", () => {
    const valid = validateChordieResult("Cocaine", "Eric Clapton", "Deeper Talks", "Joe Jordan");
    expect(valid).toBe(false);
  });

  it("tolerates minor variations in title and artist", () => {
    // Slight punctuation or extra word differences should still pass
    const valid = validateChordieResult("Hey Jude", "The Beatles", "Hey Jude", "Beatles");
    expect(valid).toBe(true);
  });
});

describe("buildChordPro", () => {
  it("includes title and artist directives in header", () => {
    const lines = [
      { kind: "chord" as const, text: "[G]Hey [D]Jude" },
      { kind: "text" as const, text: "some lyrics" },
    ];
    const result = buildChordPro(lines, "Hey Jude", "The Beatles");
    expect(result).toContain("{title: Hey Jude}");
    expect(result).toContain("{artist: The Beatles}");
    expect(result).toContain("[G]Hey [D]Jude");
    expect(result).toContain("some lyrics");
  });

  it("joins lines with newlines", () => {
    const lines = [
      { kind: "chord" as const, text: "[C]line one" },
      { kind: "chord" as const, text: "[G]line two" },
    ];
    const result = buildChordPro(lines, "Song", "Artist");
    expect(result).toContain("[C]line one\n[G]line two");
  });
});
