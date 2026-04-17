import { describe, it, expect } from "vitest";
import { CHORD_DB, normalizeChord } from "@/lib/chord-diagrams/chord-db";

describe("CHORD_DB structural checks", () => {
  it("every entry has a fingers array", () => {
    for (const [name, entry] of Object.entries(CHORD_DB)) {
      expect(Array.isArray(entry.fingers), `${name}.fingers should be an array`).toBe(true);
    }
  });

  it("every entry has a barres array", () => {
    for (const [name, entry] of Object.entries(CHORD_DB)) {
      expect(Array.isArray(entry.barres), `${name}.barres should be an array`).toBe(true);
    }
  });

  it("finger tuples have string number 1–6 and valid fret values", () => {
    for (const [name, entry] of Object.entries(CHORD_DB)) {
      for (const finger of entry.fingers) {
        const [stringNum, fret] = finger;
        expect(
          typeof stringNum === "number" && stringNum >= 1 && stringNum <= 6,
          `${name}: string number ${stringNum} out of range`
        ).toBe(true);
        const validFret =
          fret === "x" ||
          fret === 0 ||
          (typeof fret === "number" && fret >= 1 && fret <= 24);
        expect(validFret, `${name}: fret value ${fret} is invalid`).toBe(true);
      }
    }
  });

  it("covers at least 30 chords", () => {
    expect(Object.keys(CHORD_DB).length).toBeGreaterThanOrEqual(30);
  });
});

describe("normalizeChord", () => {
  it("returns exact match if present", () => {
    expect(normalizeChord("C")).toBe("C");
    expect(normalizeChord("Am")).toBe("Am");
    expect(normalizeChord("G7")).toBe("G7");
  });

  it("returns null for empty string", () => {
    expect(normalizeChord("")).toBeNull();
  });

  it("returns null for unknown chords with no fallback", () => {
    expect(normalizeChord("Xyz")).toBeNull();
  });

  it("falls back maj7 extension to simpler chord", () => {
    // Gmaj7 is in DB
    expect(normalizeChord("Gmaj7")).toBe("Gmaj7");
    // Gmaj9 -> Gmaj7
    expect(normalizeChord("Gmaj9")).toBe("Gmaj7");
  });

  it("falls back 7 extension to base chord when 7 not in DB", () => {
    // F7 not in DB, should fall back to F
    expect(normalizeChord("F7")).toBe("F");
  });

  it("strips add extensions", () => {
    // Cadd9 -> C
    expect(normalizeChord("Cadd9")).toBe("C");
    // Gadd2 -> G
    expect(normalizeChord("Gadd2")).toBe("G");
  });

  it("strips sus extensions", () => {
    // Dsus2 is in DB
    expect(normalizeChord("Dsus2")).toBe("Dsus2");
    // Csus2 is in DB
    expect(normalizeChord("Csus2")).toBe("Csus2");
  });

  it("strips aug and falls back to major", () => {
    // Caug -> C
    expect(normalizeChord("Caug")).toBe("C");
  });

  it("handles dim chords", () => {
    // Cdim -> Cm
    expect(normalizeChord("Cdim")).toBe("Cm");
  });

  it("falls back m7 to minor", () => {
    // Cm7 is not in DB, fall back to Cm
    expect(normalizeChord("Cm7")).toBe("Cm");
  });
});
