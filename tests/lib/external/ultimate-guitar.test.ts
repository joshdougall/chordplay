import { describe, it, expect } from "vitest";
import { decodeDataContent, ugContentToChordPro, parseUgStore } from "@/lib/external/ultimate-guitar";

describe("decodeDataContent", () => {
  it("decodes &quot; to double quotes", () => {
    expect(decodeDataContent("&quot;hello&quot;")).toBe('"hello"');
  });

  it("decodes &amp;", () => {
    expect(decodeDataContent("a &amp; b")).toBe("a & b");
  });

  it("decodes &lt; and &gt;", () => {
    expect(decodeDataContent("&lt;tag&gt;")).toBe("<tag>");
  });

  it("decodes &#39; to apostrophe", () => {
    expect(decodeDataContent("it&#39;s")).toBe("it's");
  });

  it("leaves plain text unchanged", () => {
    expect(decodeDataContent("hello world")).toBe("hello world");
  });
});

describe("ugContentToChordPro", () => {
  it("converts [ch]C[/ch] to [C]", () => {
    expect(ugContentToChordPro("[ch]C[/ch]")).toBe("[C]");
  });

  it("converts multiple chord tags in one line", () => {
    expect(ugContentToChordPro("[ch]G[/ch] some words [ch]Am[/ch]")).toBe("[G] some words [Am]");
  });

  it("converts complex chord names", () => {
    expect(ugContentToChordPro("[ch]D/F#[/ch] [ch]Cmaj7[/ch]")).toBe("[D/F#] [Cmaj7]");
  });

  it("strips [tab] and [/tab] markers", () => {
    expect(ugContentToChordPro("[tab]some content[/tab]")).toBe("some content");
  });

  it("strips nested [tab] wrapping chords", () => {
    const input = "[tab][ch]G[/ch] lyrics[/tab]";
    expect(ugContentToChordPro(input)).toBe("[G] lyrics");
  });

  it("trims leading/trailing whitespace", () => {
    expect(ugContentToChordPro("  [ch]C[/ch]  ")).toBe("[C]");
  });

  it("preserves multi-line content", () => {
    const input = "[ch]G[/ch] Verse line\n[ch]D[/ch] Another line";
    const result = ugContentToChordPro(input);
    expect(result).toContain("[G] Verse line");
    expect(result).toContain("[D] Another line");
  });
});

describe("parseUgStore", () => {
  it("returns null when no data-content attribute is present", () => {
    expect(parseUgStore("<html><body>no store</body></html>")).toBeNull();
  });

  it("returns null on invalid JSON after decoding", () => {
    expect(parseUgStore('data-content="not valid json"')).toBeNull();
  });

  it("parses a simple JSON object from data-content", () => {
    const obj = { store: { page: { data: { results: [] } } } };
    // Encode it as it would appear in HTML attribute
    const encoded = JSON.stringify(obj)
      .replace(/"/g, "&quot;")
      .replace(/&/g, "&amp;"); // double-encode & for attribute context
    const html = `<div data-content="${encoded}"></div>`;
    // parseUgStore only handles single-level entity encoding
    const simpleEncoded = JSON.stringify(obj).replace(/"/g, "&quot;");
    const simpleHtml = `<div data-content="${simpleEncoded}"></div>`;
    const result = parseUgStore(simpleHtml);
    expect(result).toEqual(obj);
  });

  it("returns null when data-content JSON is malformed", () => {
    const html = `<div data-content="{&quot;broken&quot;: "></div>`;
    expect(parseUgStore(html)).toBeNull();
  });
});
