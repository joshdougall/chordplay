import { describe, it, expect } from "vitest";
import { detectKey, capoSuggestion, normalizeChordRoot } from "@/lib/music/key-detection";

describe("normalizeChordRoot", () => {
  it("extracts plain root", () => {
    expect(normalizeChordRoot("C")).toBe("C");
    expect(normalizeChordRoot("G")).toBe("G");
  });

  it("extracts sharp root", () => {
    expect(normalizeChordRoot("F#m")).toBe("F#");
    expect(normalizeChordRoot("C#maj7")).toBe("C#");
  });

  it("extracts flat root", () => {
    expect(normalizeChordRoot("Bbsus4")).toBe("Bb");
    expect(normalizeChordRoot("Ebm")).toBe("Eb");
  });

  it("handles slash chords", () => {
    expect(normalizeChordRoot("Cmaj7/E")).toBe("C");
    expect(normalizeChordRoot("G/B")).toBe("G");
  });

  it("returns null for non-chord strings", () => {
    expect(normalizeChordRoot("")).toBeNull();
    expect(normalizeChordRoot("1234")).toBeNull();
  });
});

describe("detectKey", () => {
  it("returns null for empty list", () => {
    expect(detectKey([])).toBeNull();
  });

  it("G major progression (G D Em C) -> G (first chord wins, top-2 by freq)", () => {
    // G: 2, D: 1, Em: 1 (root E), C: 1 — G appears twice but here each once
    // With equal counts the first chord (G) wins because it's in the top 2
    expect(detectKey(["G", "D", "Em", "C"])).toBe("G");
  });

  it("uses most-frequent root when first chord is rare", () => {
    // C:6, A:3 (from Am), B:1 — B is first but ranks third in frequency.
    // Top 2 are C and A, so B misses the cut and the most-frequent (C) wins.
    const chords = ["B", "C", "C", "Am", "Am", "Am", "C", "F", "C", "C", "C"];
    expect(detectKey(chords)).toBe("C");
  });

  it("first-chord heuristic: if first chord is in top 2 frequencies, prefer it", () => {
    // G and C tied, but G is first
    const chords = ["G", "C", "G", "C", "D", "Em"];
    expect(detectKey(chords)).toBe("G");
  });

  it("D major progression (D A Bm G) -> D", () => {
    expect(detectKey(["D", "A", "Bm", "G"])).toBe("D");
  });

  it("handles chords with extensions", () => {
    expect(detectKey(["Cmaj7", "Am7", "Fmaj7", "G7"])).toBe("C");
  });

  it("returns a key even for a single chord", () => {
    expect(detectKey(["Em"])).toBe("E");
  });
});

describe("capoSuggestion", () => {
  it("returns null when semitones <= 0", () => {
    expect(capoSuggestion("G", 0)).toBeNull();
    expect(capoSuggestion("G", -1)).toBeNull();
    expect(capoSuggestion("G", -2)).toBeNull();
  });

  it("capo 2 on G shapes sounds in A", () => {
    // Song in G, transposed +2 -> displayed key A, capo 2, shape key G
    const result = capoSuggestion("A", 2);
    expect(result).toEqual({ capoFret: 2, shapeKey: "G" });
  });

  it("capo 3 on G shapes sounds in A#/Bb", () => {
    const result = capoSuggestion("A#", 3);
    expect(result).toEqual({ capoFret: 3, shapeKey: "G" });
  });

  it("capo 5 on C shapes sounds in F", () => {
    const result = capoSuggestion("F", 5);
    expect(result).toEqual({ capoFret: 5, shapeKey: "C" });
  });

  it("returns null for unrecognised key", () => {
    expect(capoSuggestion("X", 2)).toBeNull();
    expect(capoSuggestion("", 2)).toBeNull();
  });

  it("wraps around chromatic scale (B + 2 -> C#, shape = A#)", () => {
    const result = capoSuggestion("C#", 2);
    expect(result).toEqual({ capoFret: 2, shapeKey: "B" });
  });
});
