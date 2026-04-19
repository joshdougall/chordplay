import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateSongsterrResult,
  buildSongsterrStub,
  SONGSTERR_ID,
  SONGSTERR_NAME,
  SongsterrProvider,
} from "@/lib/external/songsterr";

// ---------------------------------------------------------------------------
// validateSongsterrResult
// ---------------------------------------------------------------------------

describe("validateSongsterrResult", () => {
  it("accepts an exact match", () => {
    expect(validateSongsterrResult("Creep", "Radiohead", "Creep", "Radiohead")).toBe(true);
  });

  it("accepts minor casing / punctuation differences", () => {
    expect(validateSongsterrResult("Hey Jude", "The Beatles", "Hey Jude", "Beatles")).toBe(true);
  });

  it("rejects when title is clearly wrong", () => {
    expect(validateSongsterrResult("Cocaine", "Eric Clapton", "Creep", "Radiohead")).toBe(false);
  });

  it("rejects when artist is clearly wrong", () => {
    expect(validateSongsterrResult("Creep", "TLC", "Creep", "Radiohead")).toBe(false);
  });

  it("rejects when both title and artist are wrong", () => {
    expect(validateSongsterrResult("Yesterday", "The Beatles", "Creep", "Radiohead")).toBe(false);
  });

  it("accepts a near-match above the 0.60 threshold", () => {
    // "Wonderwall" vs "Wonderwalls" — close enough
    expect(validateSongsterrResult("Wonderwall", "Oasis", "Wonderwalls", "Oasis")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildSongsterrStub
// ---------------------------------------------------------------------------

describe("buildSongsterrStub", () => {
  const url = "https://www.songsterr.com/a/wa/song?id=12345";

  it("includes the ChordPro title and artist directives", () => {
    const stub = buildSongsterrStub("Creep", "Radiohead", url);
    expect(stub).toContain("{title: Creep}");
    expect(stub).toContain("{artist: Radiohead}");
  });

  it("includes the Songsterr URL", () => {
    const stub = buildSongsterrStub("Creep", "Radiohead", url);
    expect(stub).toContain(url);
  });

  it("mentions Guitar Pro / playback so the user knows what they're getting", () => {
    const stub = buildSongsterrStub("Creep", "Radiohead", url);
    expect(stub.toLowerCase()).toContain("guitar pro");
  });
});

// ---------------------------------------------------------------------------
// SongsterrProvider — fetch (mocked HTTP)
// ---------------------------------------------------------------------------

describe("SongsterrProvider.fetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when the API returns an empty array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));
    const result = await SongsterrProvider.fetch("Radiohead", "Creep");
    expect(result).toBeNull();
  });

  it("returns null when the API call fails (non-ok response)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await SongsterrProvider.fetch("Radiohead", "Creep");
    expect(result).toBeNull();
  });

  it("returns null when no result passes validation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { songId: 1, artist: "TLC", title: "Creep", hasChords: true },
      ],
    }));
    // "Creep" by TLC ≠ "Creep" by Radiohead (artist mismatch)
    const result = await SongsterrProvider.fetch("Radiohead", "Creep");
    expect(result).toBeNull();
  });

  it("returns a stub ExternalChords on a valid match", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { songId: 12345, artist: "Radiohead", title: "Creep", hasChords: true },
      ],
    }));
    const result = await SongsterrProvider.fetch("Radiohead", "Creep");
    expect(result).not.toBeNull();
    expect(result!.source).toBe(SONGSTERR_ID);
    expect(result!.sourceName).toBe(SONGSTERR_NAME);
    expect(result!.sourceUrl).toContain("12345");
    expect(result!.title).toBe("Creep");
    expect(result!.artist).toBe("Radiohead");
    expect(result!.content).toContain("{title: Creep}");
    expect(result!.content).toContain("songsterr.com");
  });

  it("picks the first result that passes validation, not just the first result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { songId: 1, artist: "TLC", title: "Creep", hasChords: true },
        { songId: 2, artist: "Radiohead", title: "Creep", hasChords: true },
      ],
    }));
    const result = await SongsterrProvider.fetch("Radiohead", "Creep");
    expect(result).not.toBeNull();
    expect(result!.sourceUrl).toContain("2"); // songId 2, not 1
  });

  it("returns null when fetch throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const result = await SongsterrProvider.fetch("Radiohead", "Creep");
    expect(result).toBeNull();
  });

  it("has the correct provider id and name", () => {
    expect(SongsterrProvider.id).toBe("songsterr");
    expect(SongsterrProvider.name).toBe("Songsterr");
  });
});
