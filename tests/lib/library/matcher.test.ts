import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LibraryIndex } from "@/lib/library/index";
import { match } from "@/lib/library/matcher";

describe("matcher", () => {
  let dir: string;
  let idx: LibraryIndex;
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "chordplay-match-"));
    writeFileSync(join(dir, "hey-jude.pro"),
      "{title: Hey Jude}\n{artist: The Beatles}\n{spotify_track_id: trk-hj}");
    writeFileSync(join(dir, "creep.pro"),
      "{title: Creep}\n{artist: Radiohead}");
    writeFileSync(join(dir, "my-favorite-place.pro"),
      "{title: My Favorite Place}\n{artist: Stephen Kellogg}");
    idx = new LibraryIndex(dir);
    await idx.rescan();
  });

  it("exact match on track id", () => {
    const r = match(idx, { trackId: "trk-hj", title: "Hey Jude (Remastered)", artists: ["The Beatles"] }, {});
    expect(r.match?.title).toBe("Hey Jude");
    expect(r.confidence).toBe("exact");
  });

  it("exact match on normalized key", () => {
    const r = match(idx, { trackId: "unknown", title: "Creep", artists: ["Radiohead"] }, {});
    expect(r.match?.title).toBe("Creep");
    expect(r.confidence).toBe("exact");
  });

  it("fuzzy match within threshold", () => {
    const r = match(idx, { trackId: "unknown", title: "Creeep", artists: ["Radiohead"] }, {});
    expect(r.match?.title).toBe("Creep");
    expect(r.confidence).toBe("fuzzy");
  });

  it("score returned on fuzzy match", () => {
    const r = match(idx, { trackId: "unknown", title: "Creeep", artists: ["Radiohead"] }, {});
    expect(r.confidence).toBe("fuzzy");
    expect(typeof r.score).toBe("number");
    expect(r.score).toBeGreaterThan(0.85);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it("no match when confidence too low", () => {
    const r = match(idx, { trackId: "unknown", title: "xyzzy", artists: ["nobody"] }, {});
    expect(r.match).toBeNull();
  });

  it("prefs override wins over index", () => {
    const r = match(
      idx,
      { trackId: "trk-hj", title: "Hey Jude", artists: ["The Beatles"] },
      { trackOverrides: { "trk-hj": "creep.pro" } }
    );
    expect(r.match?.title).toBe("Creep");
    expect(r.confidence).toBe("exact");
  });

  it("false-match scenario: unrelated title and artist does not match My Favorite Place", () => {
    const r = match(idx, { trackId: "unknown", title: "favorite country song", artists: ["some artist"] }, {});
    expect(r.match).toBeNull();
  });

  it("populates allMatches when multiple versions exist for same song", async () => {
    writeFileSync(join(dir, "creep-v2.pro"), "{title: Creep}\n{artist: Radiohead}\n{version: Acoustic}");
    await idx.rescan();
    const r = match(idx, { trackId: "unknown", title: "Creep", artists: ["Radiohead"] }, {});
    expect(r.match?.title).toBe("Creep");
    expect(r.allMatches).toBeDefined();
    expect(r.allMatches!.length).toBe(2);
  });
});
