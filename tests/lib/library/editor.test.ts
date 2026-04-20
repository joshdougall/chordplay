import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeEntry, createEntry, safePath, setSpotifyTrackId, setVersionName, removeSpotifyTrackId } from "@/lib/library/editor";

describe("editor", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-edit-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("safePath rejects traversal", () => {
    expect(() => safePath(dir, "../etc/passwd")).toThrow();
    expect(() => safePath(dir, "/absolute/elsewhere.pro")).toThrow();
    expect(safePath(dir, "a/b.pro")).toBe(join(dir, "a/b.pro"));
  });

  it("writeEntry updates an existing file atomically", async () => {
    writeFileSync(join(dir, "a.pro"), "old");
    await writeEntry(dir, "a.pro", "new contents");
    expect(readFileSync(join(dir, "a.pro"), "utf8")).toBe("new contents");
  });

  it("createEntry writes a new chordpro file with directives", async () => {
    const id = await createEntry(dir, {
      title: "Test Song", artist: "Test Artist", format: "chordpro",
      content: "[C]hello", spotifyTrackId: "trk-123"
    });
    const text = readFileSync(join(dir, id), "utf8");
    expect(text).toContain("{title: Test Song}");
    expect(text).toContain("{artist: Test Artist}");
    expect(text).toContain("{spotify_track_id: trk-123}");
    expect(text).toContain("[C]hello");
  });

  it("setSpotifyTrackId inserts directive when missing", async () => {
    const content = "{title: My Song}\n{artist: Some Artist}\n\n[C]lyrics\n";
    writeFileSync(join(dir, "my-song.pro"), content);
    await setSpotifyTrackId(dir, "my-song.pro", "trk-new");
    const text = readFileSync(join(dir, "my-song.pro"), "utf8");
    expect(text).toContain("{spotify_track_id: trk-new}");
  });

  it("setVersionName inserts version directive when missing", async () => {
    const content = "{title: My Song}\n{artist: Some Artist}\n\n[C]lyrics\n";
    writeFileSync(join(dir, "versioned.pro"), content);
    await setVersionName(dir, "versioned.pro", "Capo 3");
    const text = readFileSync(join(dir, "versioned.pro"), "utf8");
    expect(text).toContain("{version: Capo 3}");
  });

  it("setVersionName replaces existing version directive", async () => {
    const content = "{title: My Song}\n{artist: Some Artist}\n{version: Old Name}\n\n[C]lyrics\n";
    writeFileSync(join(dir, "versioned2.pro"), content);
    await setVersionName(dir, "versioned2.pro", "New Name");
    const text = readFileSync(join(dir, "versioned2.pro"), "utf8");
    expect(text).toContain("{version: New Name}");
    expect(text).not.toContain("Old Name");
  });

  it("setSpotifyTrackId replaces existing directive", async () => {
    const content = "{title: My Song}\n{artist: Some Artist}\n{spotify_track_id: trk-old}\n\n[C]lyrics\n";
    writeFileSync(join(dir, "my-song2.pro"), content);
    await setSpotifyTrackId(dir, "my-song2.pro", "trk-new");
    const text = readFileSync(join(dir, "my-song2.pro"), "utf8");
    expect(text).toContain("{spotify_track_id: trk-new}");
    expect(text).not.toContain("trk-old");
  });

  it("removeSpotifyTrackId strips the directive and leaves other content intact", async () => {
    const content = "{title: My Song}\n{artist: Some Artist}\n{spotify_track_id: trk-abc}\n\n[C]lyrics\n";
    writeFileSync(join(dir, "remove-test.pro"), content);
    await removeSpotifyTrackId(dir, "remove-test.pro");
    const text = readFileSync(join(dir, "remove-test.pro"), "utf8");
    expect(text).not.toContain("spotify_track_id");
    expect(text).toContain("{title: My Song}");
    expect(text).toContain("{artist: Some Artist}");
    expect(text).toContain("[C]lyrics");
  });

  it("removeSpotifyTrackId is a no-op when no directive exists", async () => {
    const content = "{title: My Song}\n{artist: Some Artist}\n\n[C]lyrics\n";
    writeFileSync(join(dir, "no-directive.pro"), content);
    await removeSpotifyTrackId(dir, "no-directive.pro");
    const text = readFileSync(join(dir, "no-directive.pro"), "utf8");
    expect(text).toContain("{title: My Song}");
    expect(text).toContain("[C]lyrics");
    expect(text).not.toContain("spotify_track_id");
  });
});
