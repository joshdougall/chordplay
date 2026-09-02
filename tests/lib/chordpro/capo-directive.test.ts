import { describe, it, expect } from "vitest";
import { parseCapoDirective } from "@/lib/chordpro/capo";

describe("parseCapoDirective", () => {
  it("reads a {capo: N} directive", () => {
    expect(parseCapoDirective("{title: X}\n{capo: 2}\n\n[C]hi")).toBe(2);
  });

  it("reads a prose CAPO: Nth FRET line, which is how the library writes it", () => {
    expect(parseCapoDirective("CAPO: 1st FRET\n\n[Intro]")).toBe(1);
    expect(parseCapoDirective("Capo 2nd fret.\n\n[Verse 1]")).toBe(2);
    expect(parseCapoDirective("capo 3\n[C]hi")).toBe(3);
  });

  it("reads a roman-numeral capo", () => {
    expect(parseCapoDirective("Capo II *\n[C]hi")).toBe(2);
  });

  it("returns null when there is no capo", () => {
    expect(parseCapoDirective("{title: X}\n{key: G}\n\n[C]hi")).toBeNull();
  });

  it("ignores a capo mentioned inside a lyric", () => {
    expect(parseCapoDirective("[C]I put a capo on my heart")).toBeNull();
  });

  it("ignores an implausible fret number", () => {
    expect(parseCapoDirective("capo 47")).toBeNull();
  });
});
