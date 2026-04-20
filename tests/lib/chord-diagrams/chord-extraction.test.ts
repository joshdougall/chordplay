import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isChordName, chordDedupKey, extractChordsFromSource } from "@/lib/chordpro/extract-chords";
import { lookupChord } from "@/lib/chord-diagrams/chord-lookup";
import { CHORD_DB } from "@/lib/chord-diagrams/chord-db";

const FIXTURES = join(__dirname, "fixtures");
const LIBRARY_FIXTURES = join(__dirname, "../library/fixtures");

function fixture(name: string) {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

function libraryFixture(name: string) {
  return readFileSync(join(LIBRARY_FIXTURES, name), "utf-8");
}

// ---------------------------------------------------------------------------
// isChordName — section label guard
// ---------------------------------------------------------------------------

describe("isChordName", () => {
  it("accepts valid note roots", () => {
    for (const root of ["A", "B", "C", "D", "E", "F", "G"]) {
      expect(isChordName(root), root).toBe(true);
    }
  });

  it("accepts common chord suffixes", () => {
    const valid = ["Am", "C#m", "Dmaj7", "F#m7", "Bb", "Eb", "G/B", "D/C", "Em7", "Asus4"];
    for (const c of valid) {
      expect(isChordName(c), c).toBe(true);
    }
  });

  it("rejects section labels", () => {
    const labels = [
      "Verse 1", "Verse", "Chorus", "Pre-Chorus", "Bridge",
      "Outro", "Intro", "Harmonica", "Solo", "Hook",
    ];
    for (const label of labels) {
      expect(isChordName(label), `"${label}" should not be a chord`).toBe(false);
    }
  });

  it("rejects empty string", () => {
    expect(isChordName("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chordDedupKey — slash chord normalization
// ---------------------------------------------------------------------------

describe("chordDedupKey", () => {
  it("strips slash bass for deduplication", () => {
    expect(chordDedupKey("D/C")).toBe("D");
    expect(chordDedupKey("D/B")).toBe("D");
    expect(chordDedupKey("D/A")).toBe("D");
    expect(chordDedupKey("G/B")).toBe("G");
    expect(chordDedupKey("C/E")).toBe("C");
    expect(chordDedupKey("Am/E")).toBe("Am");
  });

  it("leaves plain chords unchanged", () => {
    expect(chordDedupKey("D")).toBe("D");
    expect(chordDedupKey("Am")).toBe("Am");
    expect(chordDedupKey("F#m7")).toBe("F#m7");
  });
});

// ---------------------------------------------------------------------------
// extractChordsFromSource — integration
// ---------------------------------------------------------------------------

describe("extractChordsFromSource — section label filtering", () => {
  it("removes UG-style section labels from chord list", () => {
    const source = fixture("ug-section-labels.pro");
    const chords = extractChordsFromSource(source);

    expect(chords).not.toContain("Verse 1");
    expect(chords).not.toContain("Chorus");
    expect(chords).not.toContain("Bridge");
    expect(chords).not.toContain("Outro");
  });

  it("keeps real chords after filtering labels", () => {
    const source = fixture("ug-section-labels.pro");
    const chords = extractChordsFromSource(source);

    expect(chords).toContain("Em");
    expect(chords).toContain("C");
    expect(chords).toContain("G");
    expect(chords).toContain("D");
    expect(chords).toContain("Am");
  });

  it("returns no duplicates in the output list", () => {
    const source = fixture("ug-section-labels.pro");
    const chords = extractChordsFromSource(source);
    const unique = new Set(chords);
    expect(chords.length).toBe(unique.size);
  });
});

describe("extractChordsFromSource — slash chord deduplication", () => {
  it("only one D-family chord appears in the Dylan fixture (whichever comes first)", () => {
    // The fixture has [D]drenched ... [D/C]bone — plain D arrives before D/C
    // so D wins the slot and D/C, D/B, D/A are all deduped away.
    const source = fixture("times-they-are-a-changin.pro");
    const chords = extractChordsFromSource(source);

    const dFamily = chords.filter(c => c === "D" || c.startsWith("D/"));
    expect(dFamily).toHaveLength(1);
  });

  it("D/C wins when it appears before plain D", () => {
    const source = "[D/C]bone [D/B]savin [D/A]stone [D]plain";
    const chords = extractChordsFromSource(source);

    const dFamily = chords.filter(c => c === "D" || c.startsWith("D/"));
    expect(dFamily).toHaveLength(1);
    expect(dFamily[0]).toBe("D/C");
  });

  it("does not produce duplicate dedup keys", () => {
    const source = fixture("times-they-are-a-changin.pro");
    const chords = extractChordsFromSource(source);

    const keys = chords.map(c => chordDedupKey(c));
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it("keeps distinct base chords separate", () => {
    const source = "[G/B]lyrics [C/E]more [D/C]here [Am]plain";
    const chords = extractChordsFromSource(source);
    // G, C, D, Am — four distinct base chords
    expect(chords).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Diagram coverage — all extracted chords should resolve
// ---------------------------------------------------------------------------

describe("diagram coverage — fixtures", () => {
  it("all chords in times-they-are-a-changin.pro have diagrams", async () => {
    const chords = extractChordsFromSource(fixture("times-they-are-a-changin.pro"));
    const missing: string[] = [];
    for (const chord of chords) {
      const diagram = await lookupChord(chord);
      if (!diagram) missing.push(chord);
    }
    expect(missing, `missing diagrams: ${missing.join(", ")}`).toHaveLength(0);
  });

  it("all chords in ug-section-labels.pro have diagrams", async () => {
    const chords = extractChordsFromSource(fixture("ug-section-labels.pro"));
    const missing: string[] = [];
    for (const chord of chords) {
      const diagram = await lookupChord(chord);
      if (!diagram) missing.push(chord);
    }
    expect(missing, `missing diagrams: ${missing.join(", ")}`).toHaveLength(0);
  });

  it("all chords in the existing library chord-sample.pro have diagrams", async () => {
    const chords = extractChordsFromSource(libraryFixture("chord-sample.pro"));
    const missing: string[] = [];
    for (const chord of chords) {
      const diagram = await lookupChord(chord);
      if (!diagram) missing.push(chord);
    }
    expect(missing, `missing diagrams: ${missing.join(", ")}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Slash chord voicings — verify curated shapes, not just base chord fallback
// ---------------------------------------------------------------------------

describe("slash chord voicings", () => {
  const SLASH_CHORDS: Array<[string, string]> = [
    ["D/C", "D"],
    ["D/B", "D"],
    ["D/A", "D"],
    ["G/B", "G"],
    ["C/E", "C"],
    ["A/E", "A"],
    ["Am/E", "Am"],
    ["Em/B", "Em"],
  ];

  for (const [slash, base] of SLASH_CHORDS) {
    it(`${slash} resolves to its own curated voicing, not the plain ${base} shape`, async () => {
      const slashDiagram = await lookupChord(slash);
      const baseDiagram = await lookupChord(base);

      expect(slashDiagram, `${slash} should have a diagram`).not.toBeNull();
      expect(slashDiagram, `${slash} should differ from ${base}`).not.toBe(baseDiagram);
      // The curated entry should be the CHORD_DB object reference
      expect(slashDiagram).toBe(CHORD_DB[slash]);
    });
  }
});
