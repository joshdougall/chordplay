import { describe, it, expect } from "vitest";
import { eChordsHtmlToChordPro, parseEChordsSearchResults } from "@/lib/external/e-chords";

// ---- Fixture HTML fragments ----

// A minimal e-chords tab page with a <pre id="core"> block.
// Chords appear as <u>CHORD</u> on the chord line directly above the lyric line.
const FIXTURE_SIMPLE_CORE = `
<html>
<body>
<h1>Creep</h1>
<h2>Radiohead</h2>
<pre id="core" class="core"><u>G</u>                                <u>B</u>
When you were here before, couldn't look you in the eye
<u>C</u>                           <u>Cm</u>
You're just like an angel, your skin makes me cry
</pre>
</body>
</html>
`;

// A tab page with no <pre id="core"> block.
const FIXTURE_NO_CORE = `<html><body><p>Nothing here</p></body></html>`;

// A tab page with empty core block.
const FIXTURE_EMPTY_CORE = `<html><body><pre id="core" class="core"></pre></body></html>`;

// A chord line with no <u> tags (plain lyric-only block).
const FIXTURE_LYRIC_ONLY_CORE = `
<html><body>
<pre id="core" class="core">This is just lyrics
No chords here at all
</pre>
</body></html>
`;

// A more complex fixture with multiple sections.
const FIXTURE_MULTI_SECTION = `
<html>
<body>
<h1>Hey Jude</h1>
<h2>The Beatles</h2>
<pre id="core" class="core"><u>F</u>         <u>C</u>
Hey Jude, don't make it bad
<u>C7</u>                    <u>F</u>
Take a sad song and make it better
</pre>
</body>
</html>
`;

// Search results page fixture.
const FIXTURE_SEARCH_RESULTS = `
<html><body>
<ul id="listResult">
  <li><a class="song" href="/chords/radiohead/creep">Creep - Radiohead</a></li>
  <li><a href="/chords/radiohead/creep-acoustic">Creep Acoustic - Radiohead</a></li>
</ul>
</body></html>
`;

const FIXTURE_SEARCH_NO_RESULTS = `<html><body><p>No results found</p></body></html>`;

// ---- Tests ----

describe("eChordsHtmlToChordPro", () => {
  it("returns empty string when no <pre id=core> block is found", () => {
    expect(eChordsHtmlToChordPro(FIXTURE_NO_CORE, "Creep", "Radiohead")).toBe("");
  });

  it("returns a string with header directives when core block is present", () => {
    const result = eChordsHtmlToChordPro(FIXTURE_SIMPLE_CORE, "Creep", "Radiohead");
    expect(result).toContain("{title: Creep}");
    expect(result).toContain("{artist: Radiohead}");
  });

  it("inlines chord markers into the following lyric line", () => {
    const result = eChordsHtmlToChordPro(FIXTURE_SIMPLE_CORE, "Creep", "Radiohead");
    // [G] should appear inline in the lyric line
    expect(result).toContain("[G]");
    expect(result).toContain("[B]");
    expect(result).toContain("[C]");
    expect(result).toContain("[Cm]");
  });

  it("chord markers appear before their corresponding syllables", () => {
    const result = eChordsHtmlToChordPro(FIXTURE_SIMPLE_CORE, "Creep", "Radiohead");
    const lines = result.split("\n").filter(l => l.includes("[G]"));
    expect(lines.length).toBeGreaterThan(0);
    // [G] should appear before the lyric text starting at its position
    expect(lines[0]).toMatch(/^\[G\]/);
  });

  it("handles lyric-only core block without crashing", () => {
    const result = eChordsHtmlToChordPro(FIXTURE_LYRIC_ONLY_CORE, "Song", "Artist");
    expect(result).toContain("{title: Song}");
    expect(result).toContain("This is just lyrics");
    expect(result).not.toContain("<u>");
  });

  it("handles empty core block gracefully", () => {
    const result = eChordsHtmlToChordPro(FIXTURE_EMPTY_CORE, "Song", "Artist");
    // Should return header with no crash
    expect(result).toContain("{title: Song}");
  });

  it("strips HTML tags from lyric lines", () => {
    const html = `<html><body>
<pre id="core"><u>Am</u>
<span class="lyric">Some lyric text</span>
</pre></body></html>`;
    const result = eChordsHtmlToChordPro(html, "Song", "Artist");
    expect(result).not.toContain("<span");
    expect(result).toContain("Some lyric text");
  });

  it("decodes HTML entities in lyrics and chord names", () => {
    const html = `<html><body>
<pre id="core"><u>D/F#</u>
Rock &amp; Roll
</pre></body></html>`;
    const result = eChordsHtmlToChordPro(html, "Song", "Artist");
    expect(result).toContain("[D/F#]");
    expect(result).toContain("Rock & Roll");
  });

  it("handles multi-section fixture correctly", () => {
    const result = eChordsHtmlToChordPro(FIXTURE_MULTI_SECTION, "Hey Jude", "The Beatles");
    expect(result).toContain("[F]");
    expect(result).toContain("[C]");
    expect(result).toContain("[C7]");
    expect(result).toContain("Hey Jude");
  });

  it("does not include raw <u> tags in output", () => {
    const result = eChordsHtmlToChordPro(FIXTURE_SIMPLE_CORE, "Creep", "Radiohead");
    expect(result).not.toContain("<u>");
    expect(result).not.toContain("</u>");
  });
});

describe("parseEChordsSearchResults", () => {
  it("returns the first valid chord page URL", () => {
    const url = parseEChordsSearchResults(FIXTURE_SEARCH_RESULTS);
    expect(url).toBe("https://www.e-chords.com/chords/radiohead/creep");
  });

  it("returns null when no chord page links are found", () => {
    expect(parseEChordsSearchResults(FIXTURE_SEARCH_NO_RESULTS)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseEChordsSearchResults("")).toBeNull();
  });

  it("skips shallow /chords/<letter> category links", () => {
    const html = `<a href="/chords/r">R</a><a href="/chords/radiohead/creep">Creep</a>`;
    const url = parseEChordsSearchResults(html);
    expect(url).toBe("https://www.e-chords.com/chords/radiohead/creep");
  });
});
