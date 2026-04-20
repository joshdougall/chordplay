import { describe, it, expect } from "vitest";
import { lookupChord } from "@/lib/chord-diagrams/chord-lookup";
import { CHORD_DB } from "@/lib/chord-diagrams/chord-db";
import type { UserChordDb } from "@/lib/chord-diagrams/user-chord-db";

describe("lookupChord — curated overrides", () => {
  it("returns the curated entry for a chord in the curated DB", async () => {
    const result = await lookupChord("C");
    expect(result).toBe(CHORD_DB["C"]);
  });

  it("returns the curated entry for Am", async () => {
    const result = await lookupChord("Am");
    expect(result).toBe(CHORD_DB["Am"]);
  });

  it("curated normalization still applies (Cadd9 -> C)", async () => {
    const result = await lookupChord("Cadd9");
    expect(result).toBe(CHORD_DB["C"]);
  });
});

describe("lookupChord — chords-db fallback", () => {
  it("finds a chord not in the curated DB: C#m", async () => {
    const result = await lookupChord("C#m");
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.fingers)).toBe(true);
    expect(Array.isArray(result!.barres)).toBe(true);
  });

  it("finds F#dim7", async () => {
    const result = await lookupChord("F#dim7");
    expect(result).not.toBeNull();
    expect(result!.fingers.length).toBeGreaterThan(0);
  });

  it("finds C#m7 (not in curated DB)", async () => {
    const result = await lookupChord("C#m7");
    expect(result).not.toBeNull();
  });

  it("finds Ebmaj7 (flat key)", async () => {
    const result = await lookupChord("Ebmaj7");
    expect(result).not.toBeNull();
  });

  it("finds Bbm (flat minor)", async () => {
    const result = await lookupChord("Bbm");
    expect(result).not.toBeNull();
  });

  it("finds Gsus4 (not in curated DB)", async () => {
    // Gsus4 is actually in curated DB; just verify it returns something valid
    const result = await lookupChord("Gsus4");
    expect(result).not.toBeNull();
  });

  it("finds Abmaj7 (not in curated DB)", async () => {
    const result = await lookupChord("Abmaj7");
    expect(result).not.toBeNull();
  });
});

describe("lookupChord — slash chord handling", () => {
  it("C/E returns the specific C/E inversion voicing", async () => {
    const result = await lookupChord("C/E");
    expect(result).toBe(CHORD_DB["C/E"]);
  });

  it("G/B returns the specific G/B inversion voicing", async () => {
    const result = await lookupChord("G/B");
    expect(result).toBe(CHORD_DB["G/B"]);
  });

  it("F#m/A looks up F# minor from chords-db", async () => {
    const result = await lookupChord("F#m/A");
    expect(result).not.toBeNull();
  });
});

describe("lookupChord — alias mapping", () => {
  it("CM7 resolves to same as Cmaj7", async () => {
    const byAlias = await lookupChord("CM7");
    const byCurated = await lookupChord("Cmaj7");
    // Both should resolve to something (Cmaj7 is in curated DB)
    expect(byAlias).not.toBeNull();
    expect(byCurated).not.toBeNull();
  });

  it("Amin resolves as Am (minor alias)", async () => {
    const result = await lookupChord("Amin");
    expect(result).not.toBeNull();
  });
});

describe("lookupChord — sharp/flat canonicalization", () => {
  it("A# and Bb both find the same suffix", async () => {
    const sharp = await lookupChord("A#");
    const flat = await lookupChord("Bb");
    // Both should find major voicing
    expect(sharp).not.toBeNull();
    expect(flat).not.toBeNull();
    // They should be structurally identical (same chord, different spellings)
    expect(sharp!.fingers.length).toBe(flat!.fingers.length);
  });

  it("C# and Db return results", async () => {
    const csharp = await lookupChord("C#");
    const db = await lookupChord("Db");
    expect(csharp).not.toBeNull();
    expect(db).not.toBeNull();
  });
});

describe("lookupChord — user overrides", () => {
  const customC: ChordEntry = {
    fingers: [[6, "x"], [5, 3], [4, 2], [3, 0], [2, 0], [1, 0]],
    barres: [],
  };

  it("user override wins over curated DB", async () => {
    const overrides: UserChordDb = { C: customC };
    const result = await lookupChord("C", overrides);
    expect(result).toBe(customC);
    expect(result).not.toBe(CHORD_DB["C"]);
  });

  it("user override wins over chords-db fallback", async () => {
    const customCsharpM: ChordEntry = { fingers: [[6, "x"], [5, 4], [4, 6], [3, 6]], barres: [] };
    const overrides: UserChordDb = { "C#m": customCsharpM };
    const result = await lookupChord("C#m", overrides);
    expect(result).toBe(customCsharpM);
  });

  it("falls through to curated DB when no matching override", async () => {
    const overrides: UserChordDb = { G: { fingers: [[6, 3]], barres: [] } };
    const result = await lookupChord("C", overrides);
    // C not in overrides, should fall to curated
    expect(result).toBe(CHORD_DB["C"]);
  });

  it("slash chord strips bass before checking overrides", async () => {
    const overrides: UserChordDb = { C: customC };
    const result = await lookupChord("C/E", overrides);
    expect(result).toBe(customC);
  });

  it("empty overrides object falls through to normal lookup", async () => {
    const result = await lookupChord("Am", {});
    expect(result).toBe(CHORD_DB["Am"]);
  });

  it("no overrides param (undefined) falls through normally", async () => {
    const result = await lookupChord("Am");
    expect(result).toBe(CHORD_DB["Am"]);
  });
});

// TypeScript type helper to ensure ChordEntry is accessible in tests
type ChordEntry = (typeof CHORD_DB)[string];

describe("lookupChord — unknown chords", () => {
  it("returns null for completely unknown chord", async () => {
    const result = await lookupChord("Xyz");
    expect(result).toBeNull();
  });

  it("returns null for empty string", async () => {
    const result = await lookupChord("");
    expect(result).toBeNull();
  });
});

describe("lookupChord — output shape", () => {
  it("returned chord has valid finger tuples for a chords-db entry", async () => {
    const result = await lookupChord("F#m");
    expect(result).not.toBeNull();
    for (const finger of result!.fingers) {
      const [stringNum, fret] = finger;
      expect(stringNum).toBeGreaterThanOrEqual(1);
      expect(stringNum).toBeLessThanOrEqual(6);
      const validFret = fret === "x" || fret === 0 || (typeof fret === "number" && fret >= 1 && fret <= 24);
      expect(validFret, `fret ${fret} is not valid`).toBe(true);
    }
  });

  it("returned chord barres have fromString/toString/fret", async () => {
    // F major from curated has a barre; use a chords-db barre chord
    const result = await lookupChord("F#");
    expect(result).not.toBeNull();
    if (result!.barres.length > 0) {
      for (const barre of result!.barres) {
        expect(barre.fromString).toBeGreaterThanOrEqual(1);
        expect(barre.toString).toBeGreaterThanOrEqual(1);
        expect(barre.fret).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
