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

  it("survives stripMetaPreamble, which is why a directive is used", () => {
    const out = withSourceDirective("{title: X}\n\n[C]hi", "https://example.com/t");
    expect(stripMetaPreamble(out)).toContain("{source: https://example.com/t}");
  });

  it("a prose Source: line would NOT survive, documenting the choice", () => {
    const prose = "Source: https://example.com/t\n\n[C]hi";
    expect(stripMetaPreamble(prose)).not.toContain("example.com");
  });
});
