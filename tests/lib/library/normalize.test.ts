import { describe, it, expect } from "vitest";
import { normalizeKey, levenshteinRatio } from "@/lib/library/normalize";

describe("normalize", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeKey("The Beatles", "Hey Jude!")).toBe("the beatles|hey jude");
  });
  it("trims and collapses whitespace", () => {
    expect(normalizeKey("  Pink  Floyd ", " Money  ")).toBe("pink floyd|money");
  });
  it("removes parenthetical live/remaster markers", () => {
    expect(normalizeKey("Radiohead", "Creep (Acoustic Version)")).toBe("radiohead|creep");
  });
});

describe("levenshteinRatio", () => {
  it("is 1.0 for equal strings", () => {
    expect(levenshteinRatio("abc", "abc")).toBe(1);
  });
  it("is 0 for completely different same-length strings", () => {
    expect(levenshteinRatio("abcd", "wxyz")).toBe(0);
  });
  it("is close to 0.85 for one typo in a 9-char string", () => {
    const r = levenshteinRatio("radiohead", "rodiohead");
    expect(r).toBeGreaterThan(0.85);
  });
});
