import { describe, it, expect } from "vitest";
import { sanitizeChordHtml } from "@/lib/chordpro/sanitize";

describe("sanitizeChordHtml", () => {
  it("strips <script> tags from chord content", () => {
    const out = sanitizeChordHtml('<div class="lyrics">hi<script>alert(1)</script></div>');
    expect(out).not.toContain("<script");
    expect(out).toContain("hi");
  });

  it("strips inline event-handler attributes (the onerror XSS vector)", () => {
    const out = sanitizeChordHtml('<div class="lyrics"><img src=x onerror="alert(1)"></div>');
    expect(out.toLowerCase()).not.toContain("onerror");
  });

  it("strips javascript: URLs", () => {
    const out = sanitizeChordHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("preserves chordsheetjs structure: class attributes and lyric text", () => {
    const html =
      '<div class="row"><div class="column"><div class="chord">C</div><div class="lyrics">Hello</div></div></div>';
    const out = sanitizeChordHtml(html);
    expect(out).toContain('class="chord"');
    expect(out).toContain('class="lyrics"');
    expect(out).toContain("C");
    expect(out).toContain("Hello");
  });
});
