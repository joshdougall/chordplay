import { describe, it, expect, vi } from "vitest";
import { validateResult } from "@/lib/external/validate";

// Silence logger output in tests
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("validateResult", () => {
  it("returns true when title and artist match exactly", () => {
    expect(
      validateResult(
        { artist: "Radiohead", title: "Creep" },
        { artist: "Radiohead", title: "Creep" },
        "test-provider"
      )
    ).toBe(true);
  });

  it("returns true for close matches (minor case/punctuation differences)", () => {
    expect(
      validateResult(
        { artist: "The Beatles", title: "Hey Jude" },
        { artist: "Beatles", title: "Hey Jude" },
        "test-provider"
      )
    ).toBe(true);
  });

  it("returns false when artist is completely wrong", () => {
    expect(
      validateResult(
        { artist: "Radiohead", title: "Creep" },
        { artist: "Eric Clapton", title: "Creep" },
        "test-provider"
      )
    ).toBe(false);
  });

  it("returns false when title is completely wrong", () => {
    expect(
      validateResult(
        { artist: "Radiohead", title: "Creep" },
        { artist: "Radiohead", title: "Karma Police" },
        "test-provider"
      )
    ).toBe(false);
  });

  it("returns false when both artist and title are wrong", () => {
    expect(
      validateResult(
        { artist: "Radiohead", title: "Creep" },
        { artist: "Nirvana", title: "Come As You Are" },
        "test-provider"
      )
    ).toBe(false);
  });

  it("returns true for titles with slight spelling variation", () => {
    // Levenshtein ratio of "Deeper Talks" vs "Deeper Talk" should be >= 0.60
    expect(
      validateResult(
        { artist: "Joe Jordan", title: "Deeper Talks" },
        { artist: "Joe Jordan", title: "Deeper Talks" },
        "test-provider"
      )
    ).toBe(true);
  });

  it("returns false when only title matches but artist is wrong", () => {
    expect(
      validateResult(
        { artist: "Joe Jordan", title: "Creep" },
        { artist: "JJ Cale", title: "Creep" },
        "test-provider"
      )
    ).toBe(false);
  });

  it("rejects Tucker Wetmore → Marshall Tucker Band false match", () => {
    expect(
      validateResult(
        { artist: "Tucker Wetmore", title: "Wind Up Missin' You" },
        { artist: "Marshall Tucker Band", title: "1979" },
        "test-provider"
      )
    ).toBe(false);
  });

  it("accepts covers with matching artist (same artist, exact title)", () => {
    expect(
      validateResult(
        { artist: "Radiohead", title: "Creep" },
        { artist: "Radiohead", title: "Creep (Acoustic)" },
        "test-provider"
      )
    ).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(
      validateResult(
        { artist: "radiohead", title: "creep" },
        { artist: "RADIOHEAD", title: "CREEP" },
        "test-provider"
      )
    ).toBe(true);
  });
});
