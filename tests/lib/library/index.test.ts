import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LibraryIndex } from "@/lib/library/index";

describe("LibraryIndex", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "chordplay-lib-"));
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("indexes files recursively", async () => {
    mkdirSync(join(dir, "beatles"), { recursive: true });
    writeFileSync(join(dir, "beatles", "hey-jude.pro"), "{title: Hey Jude}\n{artist: The Beatles}");
    writeFileSync(join(dir, "misc.txt"), "e|---0---0---\n");
    const idx = new LibraryIndex(dir);
    await idx.rescan();
    const all = idx.all();
    expect(all).toHaveLength(2);
    const hj = all.find(e => e.title === "Hey Jude")!;
    expect(hj.artist).toBe("The Beatles");
    expect(hj.format).toBe("chordpro");
    const tab = all.find(e => e.format === "ascii-tab")!;
    expect(tab).toBeDefined();
  });

  it("lookupByTrackId returns entry when directive present", async () => {
    writeFileSync(join(dir, "song.pro"), "{title: X}\n{artist: Y}\n{spotify_track_id: abc123}");
    const idx = new LibraryIndex(dir);
    await idx.rescan();
    const e = idx.lookupByTrackId("abc123");
    expect(e?.title).toBe("X");
  });

  it("lookupByKey returns entries for normalized key", async () => {
    writeFileSync(join(dir, "a.pro"), "{title: Hey Jude!}\n{artist: The Beatles}");
    const idx = new LibraryIndex(dir);
    await idx.rescan();
    const list = idx.lookupByKey("the beatles|hey jude");
    expect(list).toHaveLength(1);
  });

  it("multiple versions share the same songKey", async () => {
    writeFileSync(join(dir, "hey-jude-v1.pro"), "{title: Hey Jude}\n{artist: The Beatles}\n{version: Original}");
    writeFileSync(join(dir, "hey-jude-v2.pro"), "{title: Hey Jude}\n{artist: The Beatles}\n{version: Capo 2}");
    const idx = new LibraryIndex(dir);
    await idx.rescan();
    const all = idx.lookupAllByKey("the beatles|hey jude");
    expect(all).toHaveLength(2);
    const names = all.map(e => e.versionName);
    expect(names).toContain("Original");
    expect(names).toContain("Capo 2");
  });
});
