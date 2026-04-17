import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPrefs, writePrefs } from "@/lib/prefs/store";

describe("prefs store", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-prefs-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns defaults when file absent", async () => {
    const p = await readPrefs(dir);
    expect(p.autoScroll).toBe(false);
    expect(p.songPreferences).toEqual({});
    expect(p.trackOverrides).toEqual({});
  });

  it("writes and reads prefs", async () => {
    await writePrefs(dir, { autoScroll: true, songPreferences: { "id1": "tab" }, trackOverrides: { "t1": "id1" }, songTranspose: {} });
    const p = await readPrefs(dir);
    expect(p.autoScroll).toBe(true);
    expect(p.songPreferences).toEqual({ "id1": "tab" });
  });

  it("round-trips songTranspose", async () => {
    await writePrefs(dir, { autoScroll: false, songPreferences: {}, trackOverrides: {}, songTranspose: { "song1": 3, "song2": -2 } });
    const p = await readPrefs(dir);
    expect(p.songTranspose).toEqual({ "song1": 3, "song2": -2 });
  });

  it("returns empty songTranspose when field absent in file", async () => {
    const { writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await writeFile(join(dir, "prefs.json"), JSON.stringify({ autoScroll: false, songPreferences: {}, trackOverrides: {} }), "utf8");
    const p = await readPrefs(dir);
    expect(p.songTranspose).toEqual({});
  });
});
