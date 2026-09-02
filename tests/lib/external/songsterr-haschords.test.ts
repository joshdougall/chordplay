import { describe, it, expect, vi, afterEach } from "vitest";
import { SongsterrProvider } from "@/lib/external/songsterr";

// Songsterr's tab data is Guitar Pro binary, and the provider only ever returns a
// link stub. Returning that stub for a song Songsterr has NO chords for is worse
// than returning nothing: it occupies the "found a sheet" slot in the UI with a
// dead end, instead of letting the user add their own.
// Observed live: every result for "Tucker Wetmore Sunburn" and for
// "Stella Lefty Boston" came back hasChords=false.

function mockSongs(songs: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => songs,
  })) as unknown as typeof fetch);
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("SongsterrProvider hasChords gating", () => {
  it("returns null when the only title match has no chords", async () => {
    mockSongs([{ songId: 5334511, artist: "Stella Lefty", title: "Boston", hasChords: false }]);
    const got = await SongsterrProvider.fetch("Stella Lefty", "Boston");
    expect(got).toBeNull();
  });

  it("returns a stub when the title match does have chords", async () => {
    mockSongs([{ songId: 42, artist: "Stella Lefty", title: "Boston", hasChords: true }]);
    const got = await SongsterrProvider.fetch("Stella Lefty", "Boston");
    expect(got).not.toBeNull();
    expect(got!.sourceUrl).toContain("id=42");
  });

  it("skips a chord-less match in favour of a later one that has chords", async () => {
    mockSongs([
      { songId: 1, artist: "Stella Lefty", title: "Boston", hasChords: false },
      { songId: 2, artist: "Stella Lefty", title: "Boston", hasChords: true },
    ]);
    const got = await SongsterrProvider.fetch("Stella Lefty", "Boston");
    expect(got!.sourceUrl).toContain("id=2");
  });

  it("still rejects a result whose title and artist do not match", async () => {
    mockSongs([{ songId: 5334511, artist: "Stella Lefty", title: "Boston", hasChords: true }]);
    const got = await SongsterrProvider.fetch("Tucker Wetmore", "Sunburn");
    expect(got).toBeNull();
  });
});
