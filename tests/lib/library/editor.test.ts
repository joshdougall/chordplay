import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeEntry, createEntry, safePath } from "@/lib/library/editor";

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
});
