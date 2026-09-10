import { describe, it, expect } from "vitest";
import { withSourceDirective } from "@/lib/external/chords";
import { stripMetaPreamble } from "@/lib/chordpro/strip-meta";

describe("withSourceDirective", () => {
  it("adds a {source:} directive after the existing directive block", () => {
    const out = withSourceDirective(
      "{title: Yellow}\n{artist: Coldplay}\n\n[C]Look at the stars",
      "https://example.com/tab/1"
    );
    expect(out).toContain("{source: https://example.com/tab/1}");
    // Directives stay together at the top, above the song body.
    const lines = out.split("\n");
    const srcIdx = lines.findIndex(l => l.startsWith("{source:"));
    const bodyIdx = lines.findIndex(l => l.includes("Look at the stars"));
    expect(srcIdx).toBeGreaterThan(-1);
    expect(srcIdx).toBeLessThan(bodyIdx);
    // Not just "somewhere above the body" — immediately after the last
    // leading directive, so an always-prepend implementation would fail this.
    const artistIdx = lines.findIndex(l => l.startsWith("{artist:"));
    expect(srcIdx).toBe(artistIdx + 1);
  });

  it("prepends when the sheet has no directives at all", () => {
    const out = withSourceDirective("[C]Look at the stars", "https://example.com/t");
    expect(out.split("\n")[0]).toBe("{source: https://example.com/t}");
  });

  it("does not add a second one if the sheet already has a source", () => {
    const src = "{source: https://example.com/original}\n\n[C]hi";
    expect(withSourceDirective(src, "https://example.com/other")).toBe(src);
  });

  it("leaves the content alone when there is no url", () => {
    expect(withSourceDirective("[C]hi", "")).toBe("[C]hi");
  });

  it("rejects a non-http url rather than embedding it", () => {
    // Defensive: the directive is rendered as a link.
    expect(withSourceDirective("[C]hi", "javascript:alert(1)")).toBe("[C]hi");
  });

  it("rejects a url containing a newline, which could otherwise inject a second directive", () => {
    // The value is spliced into a line that is later join("\n")ed, so an
    // embedded newline expands into real lines and a nested {source: ...}
    // among them would win the render-side extraction.
    const evil = "https://real.example.com/x\n{source: https://attacker.evil/phish}\nmore";
    expect(withSourceDirective("{title: X}\n\n[C]hi", evil)).toBe("{title: X}\n\n[C]hi");
  });

  it("rejects a url containing a brace, which would truncate on read-back", () => {
    expect(withSourceDirective("[C]hi", "https://example.com/a}b")).toBe("[C]hi");
  });

  it("still accepts a normal url with a query string and fragment", () => {
    const out = withSourceDirective("[C]hi", "https://example.com/a?b=1&c=2#frag");
    expect(out).toContain("{source: https://example.com/a?b=1&c=2#frag}");
  });

  it("survives stripMetaPreamble, which is why a directive is used", () => {
    const out = withSourceDirective("{title: X}\n\n[C]hi", "https://example.com/t");
    expect(stripMetaPreamble(out)).toContain("{source: https://example.com/t}");
  });

  it("a prose Source: line would NOT survive, documenting the choice", () => {
    const prose = "Source: https://example.com/t\n\n[C]hi";
    expect(stripMetaPreamble(prose)).not.toContain("example.com");
  });
});
