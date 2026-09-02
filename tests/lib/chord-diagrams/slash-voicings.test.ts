import { describe, it, expect } from "vitest";
import { ChordProParser } from "chordsheetjs";
import { extractUniqueChords } from "@/lib/chordpro/extract-chords";
import { hasExactVoicing } from "@/lib/chord-diagrams/chord-lookup";

const parse = (src: string) => new ChordProParser().parse(src);

describe("extractUniqueChords and slash chords", () => {
  it("gives a slash chord its own palette entry", () => {
    // Previously D and D/F# collapsed to one entry, so whichever appeared
    // first won and the other's voicing was never shown. D/F# is the most-used
    // slash chord in the library at 96 occurrences.
    const chords = extractUniqueChords(parse("[D]one [D/F#]two [G]three"));
    expect(chords).toContain("D");
    expect(chords).toContain("D/F#");
  });

  it("surfaces a curated slash voicing that used to be collapsed away", () => {
    const chords = extractUniqueChords(parse("[D]one [D/C]two [D/B]three"));
    expect(chords).toEqual(["D", "D/C", "D/B"]);
  });

  it("still deduplicates genuinely repeated chords", () => {
    expect(extractUniqueChords(parse("[G]a [G]b [G]c"))).toEqual(["G"]);
  });
});

describe("hasExactVoicing", () => {
  it("is true for a plain chord in the curated set", () => {
    expect(hasExactVoicing("D")).toBe(true);
  });

  it("is true for a slash chord that has its own curated voicing", () => {
    expect(hasExactVoicing("D/C")).toBe(true);
    expect(hasExactVoicing("G/B")).toBe(true);
  });

  it("is FALSE for a slash chord with no voicing, so the UI can say so", () => {
    // These fall back to the plain shape with the bass note dropped, which was
    // happening silently across 120 occurrences.
    expect(hasExactVoicing("D/F#")).toBe(false);
    expect(hasExactVoicing("Bm/F#")).toBe(false);
    expect(hasExactVoicing("Em7/D")).toBe(false);
  });

  it("treats a user override as exact", () => {
    expect(hasExactVoicing("D/F#", { "D/F#": { fingers: [] } } as never)).toBe(true);
  });
});
