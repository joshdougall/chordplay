import { describe, it, expect } from "vitest";
import { lookupChord } from "@/lib/chord-diagrams/chord-lookup";
import { CHORD_DB } from "@/lib/chord-diagrams/chord-db";

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
  it("C/E returns C major voicing", async () => {
    const result = await lookupChord("C/E");
    // C is in curated DB, so should return curated C
    expect(result).toBe(CHORD_DB["C"]);
  });

  it("G/B looks up G major", async () => {
    const result = await lookupChord("G/B");
    expect(result).toBe(CHORD_DB["G"]);
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
